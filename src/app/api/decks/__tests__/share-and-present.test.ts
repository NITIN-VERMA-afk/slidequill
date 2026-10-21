process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { POST as sharePost, DELETE as shareDelete } from "../[id]/share/route";
import { GET as publicDeckGet } from "@/app/api/public/decks/[slug]/route";
import { proxy } from "@/proxy";
import { buildPublicDeckPayload, generateShareSlug, toPublicSlide } from "@/lib/share";
import { signAccessToken, __setMockHeaders } from "@/lib/auth";
import { executeAccountDelete } from "@/app/api/account/delete/route";
import { generateMetadata } from "@/app/p/[slug]/page";
import { __setMockPublicDeckReadLimiter, __setMockPublicDeckMissLimiter } from "@/lib/ratelimit";

function setAuthToken(token?: string) {
  if (!token) {
    __setMockHeaders(null);
    return;
  }
  __setMockHeaders({
    cookies: async () => ({
      get: (name: string) => (name === "sq_at" ? { value: token } : undefined),
    }),
  });
}

describe("Phase 2: Fullscreen Present & Public Share Links", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("slug generation produces 12+ char high-entropy base64url strings", () => {
    const slug1 = generateShareSlug();
    const slug2 = generateShareSlug();
    assert.ok(slug1.length >= 12, `Slug length must be >= 12, got ${slug1.length}`);
    assert.ok(slug2.length >= 12, `Slug length must be >= 12, got ${slug2.length}`);
    assert.notEqual(slug1, slug2);
    assert.ok(/^[A-Za-z0-9_-]+$/.test(slug1), "Slug must be URL-safe base64url");
  });

  it("blocks sharing on non-ready decks with 400 Bad Request", async () => {
    const user = await User.create({ name: "Alice", email: "alice@test.com" });
    const token = await signAccessToken(user._id.toString(), "user");

    const draftDeck = await Deck.create({
      userId: user._id,
      title: "Draft Presentation",
      status: "outlining",
      slides: [],
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${draftDeck._id}/share`, {
      method: "POST",
      headers: {
        cookie: `sq_at=${token}`,
        origin: "http://localhost:3000",
      },
    });

    setAuthToken(token);
    const res = await sharePost(req, { params: Promise.resolve({ id: draftDeck._id.toString() }) });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("ready"), "Must block sharing for non-ready decks");
  });

  it("rejects non-owner share requests with 404", async () => {
    const owner = await User.create({ name: "Bob", email: "bob@test.com" });
    const stranger = await User.create({ name: "Eve", email: "eve@test.com" });
    const strangerToken = await signAccessToken(stranger._id.toString(), "user");

    const deck = await Deck.create({
      userId: owner._id,
      title: "Secret Strategy",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Strategy", content: {}, notes: "" }],
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/share`, {
      method: "POST",
      headers: {
        cookie: `sq_at=${strangerToken}`,
        origin: "http://localhost:3000",
      },
    });

    setAuthToken(strangerToken);
    const res = await sharePost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(res.status, 404);
  });

  it("old slug becomes 404 after revoke + re-enable (re-enabling generates a new slug)", async () => {
    const user = await User.create({ name: "Charlie", email: "charlie@test.com" });
    const token = await signAccessToken(user._id.toString(), "user");

    const deck = await Deck.create({
      userId: user._id,
      title: "Quarterly Roadmap",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Roadmap 2026", content: {}, notes: "" }],
    });

    // 1. Initial share enablement
    const req1 = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/share`, {
      method: "POST",
      headers: { cookie: `sq_at=${token}`, origin: "http://localhost:3000" },
    });
    setAuthToken(token);
    const res1 = await sharePost(req1, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    const firstSlug = data1.slug;
    assert.ok(firstSlug, "Must return initial share slug");

    // Public read works on first slug
    const publicReq1 = new NextRequest(`http://localhost:3000/api/public/decks/${firstSlug}`);
    const pubRes1 = await publicDeckGet(publicReq1, { params: Promise.resolve({ slug: firstSlug }) });
    assert.equal(pubRes1.status, 200);

    // 2. Revoke share
    const reqRevoke = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/share`, {
      method: "DELETE",
      headers: { cookie: `sq_at=${token}`, origin: "http://localhost:3000" },
    });
    setAuthToken(token);
    const resRevoke = await shareDelete(reqRevoke, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(resRevoke.status, 200);

    // Public read on first slug is now immediately 404
    const pubResAfterRevoke = await publicDeckGet(publicReq1, { params: Promise.resolve({ slug: firstSlug }) });
    assert.equal(pubResAfterRevoke.status, 404, "Revoked slug must return 404 immediately");

    // 3. Re-enable share
    const reqReenable = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/share`, {
      method: "POST",
      headers: { cookie: `sq_at=${token}`, origin: "http://localhost:3000" },
    });
    setAuthToken(token);
    const resReenable = await sharePost(reqReenable, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(resReenable.status, 200);
    const dataReenable = await resReenable.json();
    const secondSlug = dataReenable.slug;

    assert.notEqual(secondSlug, firstSlug, "Re-enabling must generate a brand new slug");

    // Old slug remains dead (404)
    const pubResOldAfterReenable = await publicDeckGet(publicReq1, { params: Promise.resolve({ slug: firstSlug }) });
    assert.equal(pubResOldAfterReenable.status, 404, "Old slug must remain 404 even after re-enabling share");

    // New slug returns 200
    const publicReq2 = new NextRequest(`http://localhost:3000/api/public/decks/${secondSlug}`);
    const pubRes2 = await publicDeckGet(publicReq2, { params: Promise.resolve({ slug: secondSlug }) });
    assert.equal(pubRes2.status, 200);
  });

  it("canary strings (notes, _stash, sourcePage, sourceText, userId) are never in public payload", async () => {
    const user = await User.create({ name: "David", email: "david@test.com", hasPurchased: false });

    const CANARY_NOTE = "SECRET_CANARY_NOTE_PRIVATE_SPEAKER_TALKING_POINTS";
    const CANARY_STASH = "SECRET_CANARY_STASH_ARCHIVED_LAYOUT_DATA";
    const CANARY_SOURCE_PAGE = "PAGES_99_105";
    const CANARY_SOURCE_TEXT = "SECRET_CONFIDENTIAL_PATENT_DOCUMENT_VERBATIM";

    const deck = await Deck.create({
      userId: user._id,
      title: "Confidential Pitch",
      status: "ready",
      sourceText: CANARY_SOURCE_TEXT,
      sourceName: "patent_draft.docx",
      slides: [
        {
          id: "slide-canary-1",
          layout: "bullets",
          title: "Public Slide Heading",
          notes: CANARY_NOTE,
          sourcePage: CANARY_SOURCE_PAGE,
          sourcePageApprox: false,
          sourceSection: "Classified Details",
          regenerations: 8,
          content: {
            bullets: ["Public Takeaway Point"],
            _stash: {
              quote: { quote: CANARY_STASH },
            },
          },
        },
      ],
      share: {
        enabled: true,
        slug: "canary-test-slug-1234",
      },
    });

    const publicReq = new NextRequest("http://localhost:3000/api/public/decks/canary-test-slug-1234");
    const pubRes = await publicDeckGet(publicReq, { params: Promise.resolve({ slug: "canary-test-slug-1234" }) });
    assert.equal(pubRes.status, 200);

    const jsonStr = JSON.stringify(await pubRes.json());

    assert.equal(jsonStr.includes(CANARY_NOTE), false, "Speaker notes must not leak into public payload");
    assert.equal(jsonStr.includes(CANARY_STASH), false, "_stash must not leak into public payload");
    assert.equal(jsonStr.includes(CANARY_SOURCE_PAGE), false, "sourcePage must not leak into public payload");
    assert.equal(jsonStr.includes(CANARY_SOURCE_TEXT), false, "sourceText must not leak into public payload");
    assert.equal(jsonStr.includes(user._id.toString()), false, "userId must not leak into public payload");
    assert.equal(jsonStr.includes("hasPurchased"), false, "hasPurchased must not be returned to public client");
    assert.equal(jsonStr.includes('"showWatermark":true'), true, "Unpaid deck owner must have showWatermark: true");

    // Check headers
    assert.equal(pubRes.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    assert.equal(pubRes.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(pubRes.headers.get("Referrer-Policy"), "no-referrer");
  });

  it("proxy allows /p/* and /api/public/* without auth and sets security headers", async () => {
    // 1. Unauthenticated request to /p/sample-slug
    const publicPageReq = new NextRequest("http://localhost:3000/p/sample-slug-1234");
    const pageRes = await proxy(publicPageReq);

    // Should NOT redirect to /login
    assert.notEqual(pageRes.status, 307);
    assert.notEqual(pageRes.status, 302);
    assert.equal(pageRes.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(pageRes.headers.get("Referrer-Policy"), "no-referrer");
    assert.ok(pageRes.headers.get("Cache-Control")?.includes("no-store"));

    // 2. Unauthenticated request to /api/public/decks/sample-slug
    const publicApiReq = new NextRequest("http://localhost:3000/api/public/decks/sample-slug-1234");
    const apiRes = await proxy(publicApiReq);
    assert.notEqual(apiRes.status, 307);
    assert.notEqual(apiRes.status, 302);

    // 3. Contrast with protected route without auth: /decks/123
    const protectedReq = new NextRequest("http://localhost:3000/decks/123456789012345678901234");
    const protectedRes = await proxy(protectedReq);
    assert.equal(protectedRes.status, 307, "Protected decks route must redirect unauthenticated visitors");
    assert.ok(protectedRes.headers.get("Location")?.includes("/login"));
  });

  it("deck deletion immediately kills the public share link", async () => {
    const user = await User.create({ name: "Edward", email: "edward@test.com" });
    const slug = "edward-shared-slug";

    const deck = await Deck.create({
      userId: user._id,
      title: "Ephemeral Presentation",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Temporary", content: {}, notes: "" }],
      share: {
        enabled: true,
        slug,
      },
    });

    const publicReq = new NextRequest(`http://localhost:3000/api/public/decks/${slug}`);
    const pubRes1 = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
    assert.equal(pubRes1.status, 200);

    // Delete deck
    await Deck.deleteOne({ _id: deck._id });

    // Link is dead
    const pubResAfterDelete = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
    assert.equal(pubResAfterDelete.status, 404, "Deleted deck must return 404");
  });

  it("nested content canary fields are strictly stripped by allow-list across layouts", () => {
    const CANARY_NESTED_BULLETS = "NESTED_CANARY_INTERNAL_PROMPT_BULLETS";
    const CANARY_NESTED_TWOCOL = "NESTED_CANARY_INTERNAL_METRICS_TWOCOL";
    const CANARY_NESTED_STATS = "NESTED_CANARY_INTERNAL_SOURCE_FORMULA";
    const CANARY_NESTED_CHART = "NESTED_CANARY_RAW_UNGROUNDED_FINANCIALS";

    // 1. Bullets layout with nested unexpected canary field
    const publicBullets = toPublicSlide({
      id: "s-b",
      layout: "bullets",
      title: "Bullets Slide",
      content: {
        bullets: ["Public Bullet 1", "Public Bullet 2"],
        secretInternalAudit: CANARY_NESTED_BULLETS,
        _stash: { layout: "chart" },
      },
    });
    assert.deepEqual(publicBullets.content.bullets, ["Public Bullet 1", "Public Bullet 2"]);
    assert.equal(publicBullets.content.secretInternalAudit, undefined);
    assert.equal(publicBullets.content._stash, undefined);
    assert.equal(JSON.stringify(publicBullets).includes(CANARY_NESTED_BULLETS), false);

    // 2. Two-column layout with nested extra fields
    const publicTwoCol = toPublicSlide({
      id: "s-tc",
      layout: "two_column",
      title: "Comparison Slide",
      content: {
        left: { heading: "Left", bullets: ["L1"], canaryLeft: CANARY_NESTED_TWOCOL },
        right: { heading: "Right", bullets: ["R1"] },
        topSecretToken: "leaked-token-1234",
      },
    });
    assert.equal((publicTwoCol.content.left as any).canaryLeft, undefined);
    assert.equal((publicTwoCol.content as any).topSecretToken, undefined);
    assert.equal(JSON.stringify(publicTwoCol).includes(CANARY_NESTED_TWOCOL), false);

    // 3. Stats layout with nested unexpected properties
    const publicStats = toPublicSlide({
      id: "s-st",
      layout: "stats",
      title: "Stats Slide",
      content: {
        stats: [{ value: "10M", label: "Users", internalFormula: CANARY_NESTED_STATS }],
        unauthorizedNote: "do not expose",
      },
    });
    assert.equal((publicStats.content.stats[0] as any).internalFormula, undefined);
    assert.equal((publicStats.content as any).unauthorizedNote, undefined);
    assert.equal(JSON.stringify(publicStats).includes(CANARY_NESTED_STATS), false);

    // 4. Chart layout
    const publicChart = toPublicSlide({
      id: "s-ch",
      layout: "chart",
      title: "Chart Slide",
      content: {
        chartType: "bar",
        chartTitle: "Revenue",
        categories: ["2024", "2025"],
        series: [{ name: "Sales", values: [100, 200] }],
        rawBackendDump: CANARY_NESTED_CHART,
      },
    });
    assert.equal((publicChart.content as any).rawBackendDump, undefined);
    assert.equal(JSON.stringify(publicChart).includes(CANARY_NESTED_CHART), false);
  });

  it("enforces 60/min public read rate limit and returns 429 Too Many Requests", async () => {
    const slug = "rate-limit-read-slug";
    await Deck.create({
      userId: new mongoose.Types.ObjectId(),
      title: "Rate Limit Presentation",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Rate Limit Test", content: {}, notes: "" }],
      share: { enabled: true, slug },
    });

    const publicReq = new NextRequest(`http://localhost:3000/api/public/decks/${slug}`);

    // Normal access under limit
    const resOk = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
    assert.equal(resOk.status, 200);

    // Mock limiter triggered after 60 requests
    __setMockPublicDeckReadLimiter({
      limit: async () => ({ success: false }),
    });

    try {
      const resRateLimited = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
      assert.equal(resRateLimited.status, 429, "Exceeding public read limit must return 429");
      assert.equal(resRateLimited.headers.get("Retry-After"), "60");
      assert.equal(resRateLimited.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    } finally {
      __setMockPublicDeckReadLimiter(null);
    }
  });

  it("enforces 20/min 404-miss rate limit and returns 429 Too Many Requests", async () => {
    const missingSlug = "non-existent-slug-xyz999";
    const missReq = new NextRequest(`http://localhost:3000/api/public/decks/${missingSlug}`);

    // Normal miss returns 404
    const res404 = await publicDeckGet(missReq, { params: Promise.resolve({ slug: missingSlug }) });
    assert.equal(res404.status, 404);

    // Exceeding 20 misses triggers 429 to prevent brute-force slug enumeration
    __setMockPublicDeckMissLimiter({
      limit: async () => ({ success: false }),
    });

    try {
      const resRateLimitedMiss = await publicDeckGet(missReq, { params: Promise.resolve({ slug: missingSlug }) });
      assert.equal(resRateLimitedMiss.status, 429, "Exceeding 404 miss limit must return 429");
      assert.equal(resRateLimitedMiss.headers.get("Retry-After"), "60");
      assert.equal(resRateLimitedMiss.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    } finally {
      __setMockPublicDeckMissLimiter(null);
    }
  });

  it("verifies security headers (no-store, X-Robots-Tag, Referrer-Policy) on /p/[slug] page & metadata", async () => {
    const slug = "headers-test-slug";
    const deck = await Deck.create({
      userId: new mongoose.Types.ObjectId(),
      title: "Header Verification Deck",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Slide", content: {}, notes: "" }],
      share: { enabled: true, slug },
    });

    // 1. Verify proxy sets security headers for /p/[slug]
    const req = new NextRequest(`http://localhost:3000/p/${slug}`);
    const res = await proxy(req);
    assert.equal(res.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");

    // 2. Verify page metadata generates strict robot noindex rules
    const metadata = await generateMetadata({ params: Promise.resolve({ slug }) });
    assert.equal(metadata.title, "Header Verification Deck | SlideQuill");
    assert.deepEqual(metadata.robots, {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    });
  });

  it("account deletion immediately deletes user decks and kills public share link", async () => {
    const user = await User.create({
      name: "Frank",
      email: "frank@test.com",
      authProvider: "google",
    });
    const slug = "frank-shared-slug";

    const deck = await Deck.create({
      userId: user._id,
      title: "Frank's Pitch",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Hello", content: {}, notes: "" }],
      share: { enabled: true, slug },
    });

    // Share link works initially
    const publicReq = new NextRequest(`http://localhost:3000/api/public/decks/${slug}`);
    const pubResBefore = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
    assert.equal(pubResBefore.status, 200);

    // Delete Frank's account
    const deleteResult = await executeAccountDelete({
      userId: user._id.toString(),
      emailConfirmation: "frank@test.com",
    });
    assert.equal(deleteResult.status, 200);

    // Verify deck is completely wiped from DB
    const deckInDb = await Deck.findById(deck._id);
    assert.equal(deckInDb, null, "Deck must be deleted on account deletion");

    // Public share link must now return 404
    const pubResAfter = await publicDeckGet(publicReq, { params: Promise.resolve({ slug }) });
    assert.equal(pubResAfter.status, 404, "Public share link must return 404 after account deletion");
  });
});

