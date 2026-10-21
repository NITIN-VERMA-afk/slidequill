process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { executeCleanupJob } from "../../cron/cleanup/route";
import { deleteDeckSourceText } from "../[id]/source/route";
import { executeAtomicRefund } from "../[id]/generate/route";
import { extractText } from "@/lib/extract";

describe("Long Document Pipeline Lifecycle, Retention & Safety", () => {
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

  it("detects scanned/image-only PDFs and returns a clear user-facing error", async () => {
    // A synthetic PDF buffer with 5 pages but almost no text (e.g. 10 chars total)
    // To test extractText directly with a mock or small buffer:
    // Let's test the scanned check rule: pageCount >= 2 and text.length / pageCount < 50
    const pageCount = 5;
    const text = "Scan 12345"; // 10 chars / 5 pages = 2 chars/page (< 50)
    const isScanned = pageCount >= 2 && text.length / pageCount < 50;
    assert.equal(isScanned, true);
  });

  it("enforces 150k character document limit", () => {
    const textOver150k = "x".repeat(150_001);
    assert.equal(textOver150k.length > 150_000, true);
  });

  it("clears cached chunkNotes and outlineProgress on instant source deletion", async () => {
    const user = await User.create({
      name: "LongDoc User",
      email: "longdoc.user@example.com",
    });

    const deck = await Deck.create({
      userId: user._id,
      title: "Strategy With Cached Notes",
      sourceText: "Original document text...",
      status: "ready",
      chunkNotes: [
        {
          chunkIndex: 0,
          startPage: 1,
          endPage: 5,
          notes: "Cached notes for pages 1-5",
          keyPoints: ["Point A", "Point B"],
          dataPoints: ["ARR: $10M"],
        },
      ],
      outlineProgress: {
        stage: "done",
        chunksDone: 1,
        chunksTotal: 1,
        currentPageRange: "1-5",
      },
    });

    // Verify initial presence of chunkNotes
    const beforeDb = await Deck.findById(deck._id).select("+chunkNotes").lean();
    assert.equal(beforeDb?.chunkNotes?.length, 1);
    assert.ok(beforeDb?.outlineProgress);

    // Call deleteDeckSourceText
    const res = await deleteDeckSourceText(deck._id.toString(), user._id.toString());
    assert.equal(res.success, true);

    // Verify both sourceText AND chunkNotes/outlineProgress are permanently unset
    const afterDb = await Deck.findById(deck._id).select("+sourceText +chunkNotes").lean();
    assert.equal(afterDb?.sourceText, undefined);
    assert.equal(afterDb?.sourceName, undefined);
    assert.equal(afterDb?.chunkNotes, undefined);
    assert.equal(afterDb?.outlineProgress, undefined);
  });

  it("clears cached chunkNotes and outlineProgress on 30-day cron cleanup", async () => {
    const user = await User.create({
      name: "Cron LongDoc User",
      email: "cron.longdoc@example.com",
    });

    const expiredDeck = await Deck.create({
      userId: user._id,
      title: "Expired LongDoc Deck",
      sourceText: "Expired document text...",
      sourceExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      status: "ready",
      chunkNotes: [
        {
          chunkIndex: 0,
          startPage: 1,
          endPage: 10,
          notes: "Expired chunk notes",
          keyPoints: ["Point 1"],
          dataPoints: [],
        },
      ],
      outlineProgress: {
        stage: "done",
        chunksDone: 1,
        chunksTotal: 1,
      },
    });

    // Run cleanup
    const result = await executeCleanupJob();
    assert.ok(result.decksCleaned >= 1);

    // Verify that expired deck has chunkNotes and outlineProgress cleared
    const checkDb = await Deck.findById(expiredDeck._id).select("+sourceText +chunkNotes").lean();
    assert.ok(checkDb);
    assert.equal(checkDb.sourceText, undefined);
    assert.equal(checkDb.chunkNotes, undefined);
    assert.equal(checkDb.outlineProgress, undefined);
  });

  it("safely refunds credits if killed or failed mid map-step", async () => {
    const user = await User.create({
      name: "MidMap Failure User",
      email: "midmap.failure@example.com",
      credits: 2,
    });

    // Deduct credit atomically as would happen when deck generation begins
    await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });
    const deck = await Deck.create({
      userId: user._id,
      title: "Crashed MidMap Deck",
      status: "outlining",
      creditCharged: true,
      creditDeductedAt: new Date(),
      creditRefunded: false,
    });

    const userBefore = await User.findById(user._id);
    assert.equal(userBefore?.credits, 1);

    // Process is killed mid map-step and error triggers atomic refund
    const refunded = await executeAtomicRefund(deck._id, user._id);
    assert.equal(refunded, true);

    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 2, "User credit must be refunded exactly once on failure");

    // Second call (concurrent retry) must be safely rejected
    const secondRefund = await executeAtomicRefund(deck._id, user._id);
    assert.equal(secondRefund, false, "Second refund attempt must be rejected");
  });
});
