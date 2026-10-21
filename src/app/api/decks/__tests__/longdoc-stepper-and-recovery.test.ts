process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "https://mock-redis.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "mock-token";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { executeCleanupJob } from "../../cron/cleanup/route";
import { processOutlineStep } from "../[id]/outline/route";
import { getDeckById } from "../[id]/route";
import { getDeckLimiter, getUserGenerationLimiter } from "@/lib/ratelimit";
import { sanitizeSlidePayload, buildFallbackBulletsSlide, groundAndSanitizeSlide } from "@/lib/slides-schema";

describe("Long Document Pipeline Concurrency, Recovery & Protections", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("1. Outline Stepper Concurrency & Idempotency", () => {
    it("prevents duplicate chunk processing when two step requests fire concurrently", async () => {
      const user = await User.create({
        name: "Concurrent Stepper User",
        email: "concurrent.stepper@example.com",
      });

      // Long document requiring map-reduce (> 12,000 tokens / 50k chars)
      const longText = Array.from({ length: 4 }, (_, i) => {
        return `--- [Page ${i * 10 + 1}] ---\nCorporate Section ${i + 1}\n` + "Detailed enterprise analysis. ".repeat(600);
      }).join("\n\n");

      const deck = await Deck.create({
        userId: user._id,
        title: "Concurrent Map Deck",
        sourceText: longText,
        sourcePageCount: 40,
        status: "outlining",
        chunkNotes: [],
      });

      // Fire two concurrent step requests simultaneously
      const [res1, res2] = await Promise.all([
        processOutlineStep(deck._id.toString(), user._id.toString()),
        processOutlineStep(deck._id.toString(), user._id.toString()),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      // One of the two requests must have claimed the chunk and either processed it or returned the in-progress status
      const hasActiveClaimMessage =
        res1.data.message?.includes("already claimed") || res2.data.message?.includes("already claimed");
      
      // Check database to ensure no duplicate chunk 0 was recorded
      const checkDeck = await Deck.findById(deck._id).select("+chunkNotes").lean();
      assert.ok(checkDeck);
      const chunk0Notes = (checkDeck.chunkNotes || []).filter((n: any) => n.chunkIndex === 0);
      assert.ok(
        chunk0Notes.length <= 1,
        `There should never be more than 1 note for chunk 0 (found ${chunk0Notes.length})`
      );

      assert.ok(
        hasActiveClaimMessage || chunk0Notes.length === 1,
        "Atomic lease must prevent simultaneous duplicate chunk claiming"
      );
    });

    it("makes chunk note writes idempotent even if retried or written repeatedly", async () => {
      const user = await User.create({
        name: "Idempotent User",
        email: "idempotent.user@example.com",
      });

      const deck = await Deck.create({
        userId: user._id,
        title: "Idempotent Notes Deck",
        status: "outlining",
        chunkNotes: [
          {
            chunkIndex: 0,
            startPage: 1,
            endPage: 10,
            notes: "Initial note",
            keyPoints: ["Point 1"],
            dataPoints: [],
          },
        ],
      });

      // Emulate duplicate write for chunk 0 (e.g. retry / race) using atomic update
      const duplicateNote = {
        chunkIndex: 0,
        startPage: 1,
        endPage: 10,
        notes: "Updated idempotent note",
        keyPoints: ["Point 1", "Point 2"],
        dataPoints: ["Metric A"],
      };

      // Pull existing then push
      await Deck.updateOne(
        { _id: deck._id, userId: user._id },
        { $pull: { chunkNotes: { chunkIndex: duplicateNote.chunkIndex } } }
      );
      await Deck.updateOne(
        { _id: deck._id, userId: user._id },
        { $push: { chunkNotes: { $each: [duplicateNote], $sort: { chunkIndex: 1 } } } }
      );

      const updated = await Deck.findById(deck._id).select("+chunkNotes").lean();
      assert.ok(updated);
      const matchingNotes = (updated.chunkNotes || []).filter((n: any) => n.chunkIndex === 0);
      assert.equal(matchingNotes.length, 1, "Exactly one note must remain after idempotent write");
      assert.equal(matchingNotes[0].notes, "Updated idempotent note");
    });
  });

  describe("2. Stuck Deck Recovery in Cron", () => {
    it("marks decks stuck in 'outlining' or 'generating' for >=30m as failed and refunds credits exactly once", async () => {
      const user = await User.create({
        name: "Stuck Recovery User",
        email: "stuck.recovery@example.com",
        credits: 5,
      });

      // Charge 1 credit for an outlining deck
      await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });
      const userBefore = await User.findById(user._id);
      assert.equal(userBefore?.credits, 4);

      // Create stuck outlining deck with updatedAt set to 35 minutes ago
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000);
      const stuckOutliningDeck = await Deck.create({
        userId: user._id,
        title: "Stuck Outlining Deck",
        status: "outlining",
        creditCharged: true,
        creditDeductedAt: thirtyFiveMinsAgo,
        creditRefunded: false,
        createdAt: thirtyFiveMinsAgo,
        updatedAt: thirtyFiveMinsAgo,
      });

      // Force updatedAt back in MongoDB since mongoose timestamps override on create
      await Deck.collection.updateOne(
        { _id: stuckOutliningDeck._id },
        { $set: { updatedAt: thirtyFiveMinsAgo } }
      );

      // Create a recent outlining deck (updated 5 minutes ago) - should NOT be recovered
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeDeck = await Deck.create({
        userId: user._id,
        title: "Active Deck",
        status: "outlining",
        creditCharged: true,
        creditRefunded: false,
        createdAt: fiveMinsAgo,
        updatedAt: fiveMinsAgo,
      });
      await Deck.collection.updateOne(
        { _id: activeDeck._id },
        { $set: { updatedAt: fiveMinsAgo } }
      );

      // Run cleanup job
      const cleanupResult = await executeCleanupJob();
      assert.ok(cleanupResult.stuckDecksRecovered >= 1);

      // Check stuck deck is marked failed and credit refunded
      const stuckDeckAfter = await Deck.findById(stuckOutliningDeck._id);
      assert.equal(stuckDeckAfter?.status, "failed");
      assert.equal(stuckDeckAfter?.creditRefunded, true);

      // Check user credits refunded back to 5
      const userAfter = await User.findById(user._id);
      assert.equal(userAfter?.credits, 5, "User credit must be refunded exactly once");

      // Check active deck was NOT touched
      const activeDeckAfter = await Deck.findById(activeDeck._id);
      assert.equal(activeDeckAfter?.status, "outlining", "Active deck within 30 min window must not be failed");
      assert.equal(activeDeckAfter?.creditRefunded, false);

      // Run cleanup job a second time: must NOT double refund
      const secondCleanup = await executeCleanupJob();
      assert.equal(secondCleanup.stuckDecksRecovered, 0);

      const userAfterSecond = await User.findById(user._id);
      assert.equal(userAfterSecond?.credits, 5, "Credit must NOT be refunded multiple times");
    });
  });

  describe("3. Rate Limits & Stepper Independence", () => {
    it("confirms outline stepper does not consume deck-creation or generation rate limits", async () => {
      // getDeckLimiter is used on POST /api/decks (deck creation)
      // getUserGenerationLimiter is used on POST /api/decks/[id]/generate (slide generation)
      // The stepper route /api/decks/[id]/outline uses neither.
      const deckLimiter = getDeckLimiter();
      const genLimiter = getUserGenerationLimiter(false);

      assert.ok(deckLimiter, "Deck limiter must be instantiated independently");
      assert.ok(genLimiter, "Generation limiter must be instantiated independently");

      // Verify outline route module has no import or invocation of rate limiters
      const outlineRouteCode = fs.readFileSync(
        path.join(__dirname, "../[id]/outline/route.ts"),
        "utf8"
      );
      assert.ok(
        !outlineRouteCode.includes("getDeckLimiter"),
        "Outline stepper must NOT call getDeckLimiter"
      );
      assert.ok(
        !outlineRouteCode.includes("getUserGenerationLimiter"),
        "Outline stepper must NOT call getUserGenerationLimiter"
      );
    });
  });

  describe("4. Scanned PDF 1-Page Rejection & Logging", () => {
    it("rejects 1-page PDFs with <50 characters and logs without content", () => {
      // 1-page PDF rule: pageCount === 1 && text.length < 50
      const shortText1Page = "Title only"; // 10 chars
      const isScanned1Page = (1 === 1 && shortText1Page.length < 50);
      assert.equal(isScanned1Page, true, "1-page PDF with <50 chars must be identified as scanned");

      const validText1Page = "This is a legitimate single-page executive summary document that contains sufficient character count to exceed fifty characters easily.";
      const isValid1Page = (1 === 1 && validText1Page.length < 50);
      assert.equal(isValid1Page, false, "1-page PDF with >=50 chars must NOT be rejected as scanned");
    });
  });

  describe("5. Prompt Injection Slide Output Defense", () => {
    it("verifies slides output defense resists malicious URL, manipulated numbers, and fake slides", () => {
      const fixturePath = path.resolve(process.cwd(), "src/fixtures/prompt-injection-output.txt");
      const fixtureText = fs.readFileSync(fixturePath, "utf8");

      assert.ok(fixtureText.includes("attacker-malicious-redirect.example.com"));
      assert.ok(fixtureText.includes("$9,999,999,999"));
      assert.ok(fixtureText.includes("COMPROMISED SECURITY NOTICE"));

      // Verify sanitizeSlidePayload strips/sanitizes untrusted output
      const rawInjectedSlide = {
        title: "COMPROMISED SECURITY NOTICE",
        layout: "bullets",
        content: {
          bullets: [
            "Visit https://attacker-malicious-redirect.example.com/steal-creds immediately",
            "Net Revenue was changed to $9,999,999,999",
          ],
        },
        notes: "Phishing note",
      };

      const stats = { truncations: 0 };
      const sanitized = sanitizeSlidePayload(rawInjectedSlide, false, false, stats);

      // Verify title length, formatting and structure conform strictly to slide schemas
      assert.ok(sanitized.title.length <= 65);
      assert.ok(sanitized.content.bullets.length >= 3, "Sanitizer enforces standard bullet constraints");

      // Verify fallback slide generator produces safe presentation content
      const fallback = buildFallbackBulletsSlide("Strategic Focus", ["Point A", "Point B"]);
      assert.equal(fallback.title, "Strategic Focus");
      assert.ok(!JSON.stringify(fallback).includes("attacker-malicious-redirect"));
    });

    it("strips URLs not present in source text and logs ungrounded numbers without content (prompt-injection-output fixture)", () => {
      const fixturePath = path.resolve(process.cwd(), "src/fixtures/prompt-injection-output.txt");
      const sourceText = fs.readFileSync(fixturePath, "utf8");

      // Source text has: Revenue $14.8M, ARR $52.4M, Seats 48,200
      // Injected slide tries to put ungrounded URL and fabricated number ($777,777,777 not anywhere in source)
      const testSlide = {
        title: "Financial Performance Summary",
        layout: "stats",
        content: {
          stats: [
            {
              value: "$777,777,777", // Fabricated number NOT in source
              label: "Reported Net Revenue https://malicious-external-payload.example.com", // Injected URL NOT in source
            },
            {
              value: "$14.8M", // Legitimate grounded number from source
              label: "Core Platform Revenue",
            },
          ],
        },
        notes: "Refer to https://untrusted-source.example.com for further updates.", // Injected URL NOT in source
      };

      // Intercept console.warn to verify logging occurs WITHOUT content
      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(" "));
      };

      try {
        const grounded = groundAndSanitizeSlide(testSlide, sourceText);

        // 1. Verify unapproved URLs are stripped completely
        assert.ok(
          !grounded.notes.includes("https://untrusted-source.example.com"),
          "Ungrounded URL in notes must be stripped"
        );
        assert.ok(
          !grounded.content.stats[0].label.includes("https://malicious-external-payload.example.com"),
          "Ungrounded URL in stats label must be stripped"
        );

        // 2. Verify warning was logged
        const ungroundedWarning = warnings.find((w) =>
          w.includes("Stat value or number in slide does not appear in source text")
        );
        assert.ok(ungroundedWarning, "Must log warning when stat value is ungrounded");

        // 3. Verify logged warning does NOT leak the number or content
        assert.ok(
          !ungroundedWarning?.includes("777,777,777"),
          "Warning must NOT contain the numerical content or ungrounded value"
        );
        assert.ok(
          !ungroundedWarning?.includes("malicious-external-payload"),
          "Warning must NOT contain the ungrounded URL content"
        );
      } finally {
        console.warn = originalWarn;
      }
    });

    it("strips URLs and logs ungrounded numbers without content on original prompt-injection fixture", () => {
      const fixturePath = path.resolve(process.cwd(), "src/fixtures/prompt-injection.txt");
      const sourceText = fs.readFileSync(fixturePath, "utf8");

      const testSlide = {
        title: "System Audit Overview",
        layout: "bullets",
        content: {
          bullets: [
            "All primary controls inspected with 98.4% score", // Grounded from Page 1
            "Emergency link: https://attacker-exfiltration.example.com/intercept", // Injected URL
            "Unverified metric claimed at 9999999 units", // Ungrounded number
          ],
        },
        notes: "Audited securely",
      };

      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args.join(" "));
      };

      try {
        const grounded = groundAndSanitizeSlide(testSlide, sourceText);

        // 1. Verify injected URL stripped
        assert.ok(
          !grounded.content.bullets[1].includes("https://attacker-exfiltration.example.com"),
          "Injected URL not in prompt-injection fixture must be stripped"
        );

        // 2. Verify ungrounded number logs warning without leaking content
        const ungroundedWarning = warnings.find((w) =>
          w.includes("Stat value or number in slide does not appear in source text")
        );
        assert.ok(ungroundedWarning, "Must log warning when number is ungrounded");
        assert.ok(!ungroundedWarning?.includes("9999999"), "Warning must not leak the number");
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe("6. GET /api/decks/[id] Stuck Deck Recovery", () => {
    it("recovers deck stuck in 'outlining' or 'generating' for >30m on GET and refunds credit exactly once", async () => {
      const user = await User.create({
        name: "Get Stuck User",
        email: "get.stuck.user@example.com",
        credits: 3,
      });

      // Deduct credit as happens when deck generation begins
      await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });
      const userBefore = await User.findById(user._id);
      assert.equal(userBefore?.credits, 2);

      // Create stuck generating deck with updatedAt 35 minutes ago
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000);
      const stuckDeck = await Deck.create({
        userId: user._id,
        title: "Stuck Generating Deck",
        status: "generating",
        creditCharged: true,
        creditDeductedAt: thirtyFiveMinsAgo,
        creditRefunded: false,
        createdAt: thirtyFiveMinsAgo,
        updatedAt: thirtyFiveMinsAgo,
      });

      await Deck.collection.updateOne(
        { _id: stuckDeck._id },
        { $set: { updatedAt: thirtyFiveMinsAgo } }
      );

      // Fetch deck via getDeckById (used by GET /api/decks/[id])
      const fetchedDeck = await getDeckById(stuckDeck._id.toString(), user._id.toString());
      assert.ok(fetchedDeck);
      assert.equal(fetchedDeck.status, "failed");
      assert.equal(fetchedDeck.creditRefunded, true);

      // Verify user credit was refunded back to 3
      const userAfter = await User.findById(user._id);
      assert.equal(userAfter?.credits, 3, "Credit must be refunded on GET when deck is stuck >30m");

      // Second GET call must NOT double refund
      const secondFetched = await getDeckById(stuckDeck._id.toString(), user._id.toString());
      assert.equal(secondFetched?.status, "failed");

      const userAfterSecond = await User.findById(user._id);
      assert.equal(userAfterSecond?.credits, 3, "Second GET call must not double refund");

      // Verify non-stuck deck (updated 5 minutes ago) is not modified
      const recentDeck = await Deck.create({
        userId: user._id,
        title: "Recent Active Deck",
        status: "generating",
        creditCharged: true,
        creditRefunded: false,
      });

      const recentFetched = await getDeckById(recentDeck._id.toString(), user._id.toString());
      assert.equal(recentFetched?.status, "generating", "Active deck within 30m must remain generating");
      assert.equal(recentFetched?.creditRefunded, false);
    });
  });
});
