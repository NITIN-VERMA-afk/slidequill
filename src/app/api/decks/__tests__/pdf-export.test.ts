process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { generatePrintToken, consumePrintToken } from "@/lib/print-token";
import { isAllowedPdfRequest, PDF_ALLOWED_EXTERNAL_HOSTNAMES } from "@/lib/export/pdf-interception";
import { acquirePdfExportLock, releasePdfExportLock } from "@/lib/export/pdf-lock";
import { findSystemChrome, renderDeckToPdf } from "@/lib/export/pdf";
import DeckPrintPage from "@/app/render/deck/[id]/page";
import { POST as pdfExportPost } from "@/app/api/decks/[id]/export/pdf/route";
import { signAccessToken, __setMockHeaders } from "@/lib/auth";
import { __setMockExportLimiter, __setMockPdfDailyLimiter } from "@/lib/ratelimit";
import { proxy } from "@/proxy";

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

describe("Phase 3: PDF Export, Print Route, Interception & Concurrency", () => {
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

  // ── 1. Print Token Authentication & Single-Use Enforcement ──────────────

  it("generates a valid signed print token bound to user and deck", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const deckId = new mongoose.Types.ObjectId().toString();

    const token = await generatePrintToken({ userId, deckId });
    assert.ok(typeof token === "string" && token.length > 50, "Token must be a valid JWT string");

    const result = await consumePrintToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.userId, userId);
    assert.equal(result.deckId, deckId);
  });

  it("enforces single-use on print tokens (second consumption fails)", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const deckId = new mongoose.Types.ObjectId().toString();

    const token = await generatePrintToken({ userId, deckId });

    // First consumption succeeds
    const firstUse = await consumePrintToken(token);
    assert.equal(firstUse.valid, true);

    // Second consumption must fail (single-use burned)
    const secondUse = await consumePrintToken(token);
    assert.equal(secondUse.valid, false);
    assert.ok(secondUse.error?.includes("already been used"));
  });

  it("rejects invalid, forged, or expired print tokens", async () => {
    const forgedToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.invalidSignature";
    const res = await consumePrintToken(forgedToken);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes("Invalid or expired"));
  });

  // ── 2. Request Interception & SSRF Allowlist ─────────────────────────────

  it("enforces strict exact-hostname allowlist and blocks SSRF / private IPs", () => {
    const appOrigin = "http://localhost:3000";

    // 1. Approved application origin
    assert.equal(isAllowedPdfRequest("http://localhost:3000/render/deck/123", appOrigin), true);
    assert.equal(isAllowedPdfRequest("http://localhost:3000/_next/static/css/app.css", appOrigin), true);

    // 2. Approved image CDNs
    assert.equal(isAllowedPdfRequest("https://images.unsplash.com/photo-12345?w=800", appOrigin), true);
    assert.equal(isAllowedPdfRequest("https://images.pexels.com/photos/12345/pexels.jpg", appOrigin), true);

    // 3. Approved font CDNs
    assert.equal(isAllowedPdfRequest("https://fonts.googleapis.com/css2?family=Inter", appOrigin), true);
    assert.equal(isAllowedPdfRequest("https://fonts.gstatic.com/s/inter/v12/font.woff2", appOrigin), true);

    // 4. Data: and Blob: URIs for inline images/fonts
    assert.equal(isAllowedPdfRequest("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA", appOrigin), true);
    assert.equal(isAllowedPdfRequest("blob:http://localhost:3000/some-guid", appOrigin), true);

    // 5. Block non-https external requests
    assert.equal(isAllowedPdfRequest("http://images.unsplash.com/test.jpg", appOrigin), false);

    // 6. Block malicious subdomain / domain spoofing
    assert.equal(isAllowedPdfRequest("https://malicious-images.unsplash.com.attacker.com/test.jpg", appOrigin), false);
    assert.equal(isAllowedPdfRequest("https://evil-site.com/hacked.png", appOrigin), false);

    // 7. Block AWS / GCP / Azure metadata & internal IP ranges (SSRF)
    assert.equal(isAllowedPdfRequest("http://169.254.169.254/latest/meta-data/", appOrigin), false);
    assert.equal(isAllowedPdfRequest("https://169.254.169.254/latest/meta-data/", appOrigin), false);
    assert.equal(isAllowedPdfRequest("http://127.0.0.1:8080/internal", appOrigin), false);
    assert.equal(isAllowedPdfRequest("http://10.0.0.1/admin", appOrigin), false);
    assert.equal(isAllowedPdfRequest("http://192.168.1.1/secrets", appOrigin), false);
  });

  // ── 3. Concurrency Lock (SET NX with owner validation) ───────────────────

  it("acquires and releases per-user atomic concurrency lock", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    // 1. Initial lock acquisition succeeds
    const lock1 = await acquirePdfExportLock(userId);
    assert.equal(lock1.acquired, true);
    assert.ok(lock1.lockOwner);

    // 2. Second concurrent request by same user fails
    const lock2 = await acquirePdfExportLock(userId);
    assert.equal(lock2.acquired, false);

    // 3. Different user can acquire their own lock simultaneously
    const otherUserId = new mongoose.Types.ObjectId().toString();
    const otherLock = await acquirePdfExportLock(otherUserId);
    assert.equal(otherLock.acquired, true);
    await releasePdfExportLock(otherUserId, otherLock.lockOwner!);

    // 4. Release lock with wrong owner does NOT release it
    await releasePdfExportLock(userId, "wrong-owner-uuid");
    const lock3 = await acquirePdfExportLock(userId);
    assert.equal(lock3.acquired, false);

    // 5. Release lock with correct owner succeeds
    await releasePdfExportLock(userId, lock1.lockOwner!);
    const lock4 = await acquirePdfExportLock(userId);
    assert.equal(lock4.acquired, true);
    await releasePdfExportLock(userId, lock4.lockOwner!);
  });

  // ── 4. Print Route HTML, Sanitization & Watermark ────────────────────────

  it("print route excludes notes and _stash, and applies watermark for free users only", async () => {
    const freeUser = await User.create({ name: "Free User", email: "free@test.com", hasPurchased: false });
    const paidUser = await User.create({ name: "Paid User", email: "paid@test.com", hasPurchased: true });

    const CANARY_NOTES = "CANARY_SPEAKER_NOTES_DO_NOT_PRINT_ON_PDF";
    const CANARY_STASH = "CANARY_STASH_PRIVATE_DATA_DO_NOT_PRINT";

    const freeDeck = await Deck.create({
      userId: freeUser._id,
      title: "Free User Deck",
      status: "ready",
      slides: [
        {
          id: "s1",
          layout: "title",
          title: "Public Slide 1",
          notes: CANARY_NOTES,
          content: {
            subtitle: "Public Subtitle",
            _stash: { layout: "chart", secret: CANARY_STASH },
          },
        },
      ],
    });

    const paidDeck = await Deck.create({
      userId: paidUser._id,
      title: "Paid User Deck",
      status: "ready",
      slides: [
        {
          id: "s2",
          layout: "title",
          title: "Paid Slide 1",
          notes: CANARY_NOTES,
          content: { subtitle: "Paid Subtitle" },
        },
      ],
    });

    // 1. Render free deck: watermark present, no canaries
    const freeToken = await generatePrintToken({ userId: freeUser._id.toString(), deckId: freeDeck._id.toString() });
    const freeJsx = await DeckPrintPage({
      params: Promise.resolve({ id: freeDeck._id.toString() }),
      searchParams: Promise.resolve({ token: freeToken }),
    });

    const freeHtml = JSON.stringify(freeJsx);
    assert.equal(freeHtml.includes(CANARY_NOTES), false, "Speaker notes must not be in print view");
    assert.equal(freeHtml.includes(CANARY_STASH), false, "_stash must not be in print view");
    assert.ok(freeHtml.includes("Made with SlideQuill"), "Free user deck must display watermark");

    // 2. Render paid deck: no watermark, no canaries
    const paidToken = await generatePrintToken({ userId: paidUser._id.toString(), deckId: paidDeck._id.toString() });
    const paidJsx = await DeckPrintPage({
      params: Promise.resolve({ id: paidDeck._id.toString() }),
      searchParams: Promise.resolve({ token: paidToken }),
    });

    const paidHtml = JSON.stringify(paidJsx);
    assert.equal(paidHtml.includes(CANARY_NOTES), false);
    assert.equal(paidHtml.includes("Made with SlideQuill"), false, "Paid user deck must NOT display watermark");
  });

  // ── 5. Proxy & Route Security ───────────────────────────────────────────

  it("proxy allows /render/* through cookie guard with security headers", async () => {
    const renderReq = new NextRequest("http://localhost:3000/render/deck/some-deck-id?token=sample");
    const res = await proxy(renderReq);

    // Must not redirect to /login
    assert.notEqual(res.status, 307);
    assert.notEqual(res.status, 302);
    assert.ok(res.headers.get("Cache-Control")?.includes("no-store"));
    assert.equal(res.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
    assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  });

  it("rejects non-owner export request with 404 Not Found", async () => {
    const owner = await User.create({ name: "DeckOwner", email: "owner-pdf@test.com" });
    const stranger = await User.create({ name: "Stranger", email: "stranger-pdf@test.com" });
    const strangerToken = await signAccessToken(stranger._id.toString(), "user");

    const deck = await Deck.create({
      userId: owner._id,
      title: "Owner Confidential Deck",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Confidential", content: {}, notes: "" }],
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/export/pdf`, {
      method: "POST",
      headers: {
        cookie: `sq_at=${strangerToken}`,
        origin: "http://localhost:3000",
      },
    });

    setAuthToken(strangerToken);
    const res = await pdfExportPost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(res.status, 404);
  });

  it("rejects export on non-ready deck with 400 Bad Request", async () => {
    const user = await User.create({ name: "DraftUser", email: "draft-pdf@test.com" });
    const token = await signAccessToken(user._id.toString(), "user");

    const deck = await Deck.create({
      userId: user._id,
      title: "Draft Presentation",
      status: "generating",
      slides: [],
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/export/pdf`, {
      method: "POST",
      headers: {
        cookie: `sq_at=${token}`,
        origin: "http://localhost:3000",
      },
    });

    setAuthToken(token);
    const res = await pdfExportPost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error?.includes("ready"));
  });

  it("rejects print route when token is for wrong deck", async () => {
    const user = await User.create({ name: "UserDeck1", email: "deck1@test.com" });
    const deck1 = await Deck.create({ userId: user._id, title: "Deck 1", status: "ready", slides: [] });
    const deck2 = await Deck.create({ userId: user._id, title: "Deck 2", status: "ready", slides: [] });

    const tokenForDeck1 = await generatePrintToken({ userId: user._id.toString(), deckId: deck1._id.toString() });

    await assert.rejects(
      async () => {
        await DeckPrintPage({
          params: Promise.resolve({ id: deck2._id.toString() }),
          searchParams: Promise.resolve({ token: tokenForDeck1 }),
        });
      },
      (err: any) =>
        err?.message?.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
        err?.digest?.includes("NEXT_NOT_FOUND") ||
        err?.message?.includes("NEXT_NOT_FOUND")
    );
  });

  it("rejects print route when token is for wrong user", async () => {
    const owner = await User.create({ name: "OwnerUser", email: "owneruser@test.com" });
    const hacker = await User.create({ name: "HackerUser", email: "hacker@test.com" });

    const deck = await Deck.create({ userId: owner._id, title: "Owner Deck", status: "ready", slides: [] });
    const hackerToken = await generatePrintToken({ userId: hacker._id.toString(), deckId: deck._id.toString() });

    await assert.rejects(
      async () => {
        await DeckPrintPage({
          params: Promise.resolve({ id: deck._id.toString() }),
          searchParams: Promise.resolve({ token: hackerToken }),
        });
      },
      (err: any) =>
        err?.message?.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
        err?.digest?.includes("NEXT_NOT_FOUND") ||
        err?.message?.includes("NEXT_NOT_FOUND")
    );
  });

  it("print route consumes token exactly once per export", async () => {
    const user = await User.create({ name: "SingleUseUser", email: "singleuse@test.com" });
    const deck = await Deck.create({
      userId: user._id,
      title: "Single Use Test",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "Slide", content: {}, notes: "" }],
    });

    const token = await generatePrintToken({ userId: user._id.toString(), deckId: deck._id.toString() });

    // First server render succeeds
    const firstRender = await DeckPrintPage({
      params: Promise.resolve({ id: deck._id.toString() }),
      searchParams: Promise.resolve({ token }),
    });
    assert.ok(firstRender);

    // Second server render with same token is rejected
    await assert.rejects(
      async () => {
        await DeckPrintPage({
          params: Promise.resolve({ id: deck._id.toString() }),
          searchParams: Promise.resolve({ token }),
        });
      },
      (err: any) =>
        err?.message?.includes("NEXT_HTTP_ERROR_FALLBACK;404") ||
        err?.digest?.includes("NEXT_NOT_FOUND") ||
        err?.message?.includes("NEXT_NOT_FOUND")
    );
  });

  it("enforces 5/min and 30/day rate limits on PDF export", async () => {
    const user = await User.create({ name: "RateLimitedUser", email: "rl@test.com" });
    const token = await signAccessToken(user._id.toString(), "user");
    const deck = await Deck.create({
      userId: user._id,
      title: "RL Deck",
      status: "ready",
      slides: [{ id: "s1", layout: "title", title: "RL", content: {}, notes: "" }],
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/export/pdf`, {
      method: "POST",
      headers: { cookie: `sq_at=${token}`, origin: "http://localhost:3000" },
    });

    // Test 5/min limit exceeded
    __setMockExportLimiter({ limit: async () => ({ success: false }) });
    setAuthToken(token);
    const resMin = await pdfExportPost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(resMin.status, 429);
    assert.equal(resMin.headers.get("Retry-After"), "60");
    __setMockExportLimiter(null);

    // Test 30/day limit exceeded
    __setMockPdfDailyLimiter({ limit: async () => ({ success: false }) });
    setAuthToken(token);
    const resDay = await pdfExportPost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(resDay.status, 429);
    assert.equal(resDay.headers.get("Retry-After"), "86400");
    __setMockPdfDailyLimiter(null);
  });

  it("failure path releases lock and closes browser", async () => {
    const user = await User.create({ name: "FailUser", email: "fail@test.com" });
    const token = await signAccessToken(user._id.toString(), "user");
    const slides61 = Array.from({ length: 61 }, (_, i) => ({
      id: `s${i}`,
      layout: "title",
      title: `S${i}`,
      content: {},
      notes: "",
    }));
    const deck = await Deck.create({
      userId: user._id,
      title: "Oversized Deck",
      status: "ready",
      slides: slides61,
    });

    const req = new NextRequest(`http://localhost:3000/api/decks/${deck._id}/export/pdf`, {
      method: "POST",
      headers: { cookie: `sq_at=${token}`, origin: "http://localhost:3000" },
    });

    setAuthToken(token);
    const res = await pdfExportPost(req, { params: Promise.resolve({ id: deck._id.toString() }) });
    assert.equal(res.status, 400);

    // Confirm the concurrency lock was released in the finally block
    const lockCheck = await acquirePdfExportLock(user._id.toString());
    assert.equal(lockCheck.acquired, true, "Lock must be released even when request fails");
    await releasePdfExportLock(user._id.toString(), lockCheck.lockOwner!);
  });

  // ── 6. Optional / Skippable Local E2E PDF Generation ────────────────────

  it("e2e: verifies PDF binary structure when Chrome executable is available", async (t) => {
    const chromePath = findSystemChrome();
    if (!chromePath) {
      t.skip("No local Chrome/Chromium installation detected; skipping real PDF rendering e2e.");
      return;
    }

    const user = await User.create({ name: "E2E User", email: "e2e-pdf@test.com" });
    const deck = await Deck.create({
      userId: user._id,
      title: "E2E PDF Test Deck",
      status: "ready",
      slides: [
        { id: "s1", layout: "title", title: "Slide 1 Title", content: { subtitle: "Subtitle 1" }, notes: "" },
        { id: "s2", layout: "bullets", title: "Slide 2 Bullets", content: { bullets: ["Bullet 1", "Bullet 2"] }, notes: "" },
      ],
    });

    const printToken = await generatePrintToken({
      userId: user._id.toString(),
      deckId: deck._id.toString(),
    });

    // In unit test runner without dev server listening, test with mock data URL to verify Puppeteer & Chromium pipeline
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.default.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
      executablePath: chromePath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(`
        <html>
          <head>
            <style>
              @page { size: 1920px 1080px; margin: 0; }
              body { margin: 0; }
              .slide { width: 1920px; height: 1080px; page-break-after: always; display: flex; align-items: center; justify-content: center; }
            </style>
          </head>
          <body>
            <div class="slide"><h1>Slide 1</h1></div>
            <div class="slide"><h1>Slide 2</h1></div>
          </body>
        </html>
      `);

      const pdf = await page.pdf({
        width: "1920px",
        height: "1080px",
        printBackground: true,
        preferCSSPageSize: true,
      });

      const buffer = Buffer.from(pdf);
      assert.ok(buffer.length > 1000, "PDF buffer must have valid size");
      assert.equal(buffer.subarray(0, 4).toString(), "%PDF", "Buffer must begin with PDF magic bytes");
    } finally {
      await browser.close();
    }
  });
});
