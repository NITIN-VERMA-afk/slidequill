process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "https://mock-redis.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "mock-token";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { processSlideBatch, executeAtomicRefund } from "../[id]/generate/route";
import { getDeckById } from "../[id]/route";
import { openai } from "@/lib/openai";

describe("Resumable Slide Generation & Concurrency Leases (Real In-Memory DB)", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    // Offline mock for OpenAI chat completions
    (openai.chat.completions as any).create = async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Strategic Overview",
              layout: "bullets",
              notes: "Executive briefing notes.",
              content: {
                bullets: [
                  "First operational objective and deliverable",
                  "Second operational objective and metric",
                ],
              },
            }),
          },
        },
      ],
      usage: { prompt_tokens: 40, completion_tokens: 30, total_tokens: 70 },
    });

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

  it("processes 4 slides per batch and safely resumes remaining slides across calls", async () => {
    const user = await User.create({
      name: "Batch User",
      email: "batch.user@example.com",
      credits: 5,
      emailVerified: true,
      hasPurchased: true,
    });

    // 6-section outline to verify 4-slide batching and resume
    const outline = [
      { id: "sec-1", title: "Introduction & Executive Summary", points: ["Vision and objectives", "Key milestones"] },
      { id: "sec-2", title: "Market Problem Analysis", points: ["Client pain points", "Current market alternatives"] },
      { id: "sec-3", title: "Proprietary Architecture", points: ["Scalable backend", "Microservices overview"] },
      { id: "sec-4", title: "Financial Highlights & Projections", points: ["Annual recurring revenue", "Operating margin growth"] },
      { id: "sec-5", title: "Go-To-Market Execution", points: ["Direct sales channels", "Partnership ecosystem"] },
      { id: "sec-6", title: "Conclusion and Next Steps", points: ["Funding requirements", "Closing summary"] },
    ];

    const deck = await Deck.create({
      userId: user._id,
      title: "Enterprise Strategy Deck",
      status: "outlined",
      outline,
      slides: [],
      creditCharged: false,
      creditRefunded: false,
    });

    // Batch 1: Should deduct 1 credit, set status to generating, process slides 0..3 (4 slides)
    const batch1 = await processSlideBatch(deck._id.toString(), user._id.toString());
    assert.equal(batch1.status, 200);
    assert.equal(batch1.data.status, "generating");
    assert.equal(batch1.data.slidesDone, 4);
    assert.equal(batch1.data.slidesTotal, 6);
    assert.equal(batch1.data.slides.length, 4);
    assert.equal(batch1.data.isComplete, false);

    // Verify 1 credit deducted
    const userAfterBatch1 = await User.findById(user._id);
    assert.equal(userAfterBatch1?.credits, 4, "Should deduct exactly 1 credit on start");

    // Verify layout plan was persisted and not lost
    const deckAfterBatch1 = await Deck.findById(deck._id);
    assert.ok(deckAfterBatch1?.slideGenerationProgress?.layoutPlan?.length === 6, "Layout plan must be persisted");
    assert.equal(deckAfterBatch1?.slidesDone, 4);
    assert.ok(!deckAfterBatch1?.slideBatchLease || !deckAfterBatch1?.slideBatchLease?.leasedAt, "Lease must be cleared on batch completion");

    // Batch 2 (Resume): Should NOT deduct credits again; generates slides 4..5 (2 slides) and marks ready
    const batch2 = await processSlideBatch(deck._id.toString(), user._id.toString());
    assert.equal(batch2.status, 200);
    assert.equal(batch2.data.status, "ready");
    assert.equal(batch2.data.slidesDone, 6);
    assert.equal(batch2.data.slidesTotal, 6);
    assert.equal(batch2.data.slides.length, 6);
    assert.equal(batch2.data.isComplete, true);

    // User credits must still be 4 (not double charged)
    const userAfterBatch2 = await User.findById(user._id);
    assert.equal(userAfterBatch2?.credits, 4, "Resuming must never charge additional credits");

    const deckFinal = await Deck.findById(deck._id);
    assert.equal(deckFinal?.status, "ready");
    assert.equal(deckFinal?.slides?.length, 6);
  });

  it("H1: 12-slide deck (3 batches) deducts exactly 1 credit; retry does not deduct again; failed deck refunds once", async () => {
    const user = await User.create({
      name: "Twelve Slide User",
      email: "twelve.slide@example.com",
      credits: 10,
      emailVerified: true,
      hasPurchased: true,
    });

    const outline12 = Array.from({ length: 12 }, (_, i) => ({
      id: `sec-${i + 1}`,
      title: `Executive Topic ${i + 1}`,
      points: [`Key point A for section ${i + 1}`, `Key point B for section ${i + 1}`],
    }));

    const deck12 = await Deck.create({
      userId: user._id,
      title: "Complete 12-Slide Corporate Plan",
      status: "outlined",
      outline: outline12,
      slides: [],
      creditCharged: false,
      creditRefunded: false,
    });

    // Batch 1 (slides 0..3): starts generation, deducts 1 credit
    const batch1 = await processSlideBatch(deck12._id.toString(), user._id.toString());
    assert.equal(batch1.status, 200);
    assert.equal(batch1.data.slidesDone, 4);

    const userAfterBatch1 = await User.findById(user._id);
    assert.equal(userAfterBatch1?.credits, 9, "Initial batch must deduct exactly 1 credit");

    const deckAfterBatch1 = await Deck.findById(deck12._id);
    assert.equal(deckAfterBatch1?.creditCharged, true, "creditCharged must be set to true on first start");

    // Batch 2 (slides 4..7): should NOT deduct credits again
    const batch2 = await processSlideBatch(deck12._id.toString(), user._id.toString());
    assert.equal(batch2.status, 200);
    assert.equal(batch2.data.slidesDone, 8);

    const userAfterBatch2 = await User.findById(user._id);
    assert.equal(userAfterBatch2?.credits, 9, "Batch 2 must not deduct another credit");

    // Retry simulation: simulating a retry of batch 2 or network interruption before batch 3
    // Even if batch request is called repeatedly, credit count must remain 9
    const batch3 = await processSlideBatch(deck12._id.toString(), user._id.toString());
    assert.equal(batch3.status, 200);
    assert.equal(batch3.data.slidesDone, 12);
    assert.equal(batch3.data.status, "ready");

    const userAfterBatch3 = await User.findById(user._id);
    assert.equal(userAfterBatch3?.credits, 9, "Total 12-slide deck across 3 batches must deduct exactly 1 credit");

    // Failure & refund verification on another charged deck
    const failingDeck = await Deck.create({
      userId: user._id,
      title: "Failed 12-Slide Deck",
      status: "generating",
      creditCharged: true,
      creditDeductedAt: new Date(),
      creditRefunded: false,
    });

    // Refund #1 -> must succeed and restore 1 credit (9 -> 10)
    const refundSuccess = await executeAtomicRefund(failingDeck._id, user._id);
    assert.equal(refundSuccess, true);

    const userAfterRefund = await User.findById(user._id);
    assert.equal(userAfterRefund?.credits, 10, "Refund must restore exactly 1 credit");

    // Duplicate retry of refund -> must be rejected and not double-refund
    const duplicateRefund = await executeAtomicRefund(failingDeck._id, user._id);
    assert.equal(duplicateRefund, false, "Duplicate refund must be rejected");

    const userFinal = await User.findById(user._id);
    assert.equal(userFinal?.credits, 10, "Credits must stay 10");
  });

  it("prevents duplicate work and race conditions via atomic batch lease when two tabs call concurrently", async () => {
    const user = await User.create({
      name: "Concurrent Lease User",
      email: "lease.user@example.com",
      credits: 3,
      emailVerified: true,
      hasPurchased: true,
    });

    const outline = [
      { id: "sec-1", title: "Section 1", points: ["Point 1"] },
      { id: "sec-2", title: "Section 2", points: ["Point 2"] },
      { id: "sec-3", title: "Section 3", points: ["Point 3"] },
      { id: "sec-4", title: "Section 4", points: ["Point 4"] },
      { id: "sec-5", title: "Section 5", points: ["Point 5"] },
    ];

    const deck = await Deck.create({
      userId: user._id,
      title: "Concurrent Strategy Deck",
      status: "generating",
      outline,
      slides: [],
      creditCharged: true,
      creditRefunded: false,
    });

    // Simulate two concurrent requests hitting processSlideBatch at the same time
    const [res1, res2] = await Promise.all([
      processSlideBatch(deck._id.toString(), user._id.toString()),
      processSlideBatch(deck._id.toString(), user._id.toString()),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // Exactly one request must have acquired the lease and progressed, while the other received inProgress: true
    const oneAcquired = (res1.data.slidesDone === 4 && res2.data.inProgress === true) ||
                        (res2.data.slidesDone === 4 && res1.data.inProgress === true);

    assert.ok(
      oneAcquired,
      `One request must successfully process the batch while concurrent request gets locked out (res1 inProgress: ${res1.data.inProgress}, res2 inProgress: ${res2.data.inProgress})`
    );

    // Verify database state has exactly 4 slides, not 8 duplicate slides
    const checkDeck = await Deck.findById(deck._id);
    assert.equal(checkDeck?.slides?.length, 4, "Slide writes must remain idempotent with no duplicate slides");
  });

  it("H6: executes lazy stuck-deck recovery on GET when deck is stalled >30 minutes", async () => {
    const user = await User.create({
      name: "Lazy Recovery User",
      email: "lazy.recovery@example.com",
      credits: 4,
    });

    // Deduct 1 credit for generation start
    await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });
    const userBefore = await User.findById(user._id);
    assert.equal(userBefore?.credits, 3);

    // Create deck stalled in "generating" for 32 minutes
    const thirtyTwoMinsAgo = new Date(Date.now() - 32 * 60 * 1000);
    const stuckDeck = await Deck.create({
      userId: user._id,
      title: "Stalled Deck In Generation",
      status: "generating",
      creditCharged: true,
      creditDeductedAt: thirtyTwoMinsAgo,
      creditRefunded: false,
      createdAt: thirtyTwoMinsAgo,
      updatedAt: thirtyTwoMinsAgo,
    });

    await Deck.collection.updateOne(
      { _id: stuckDeck._id },
      { $set: { updatedAt: thirtyTwoMinsAgo } }
    );

    // Fetch deck lazily via getDeckById
    const fetched = await getDeckById(stuckDeck._id.toString(), user._id.toString());
    assert.ok(fetched);
    assert.equal(fetched.status, "failed");
    assert.equal(fetched.creditRefunded, true);

    // Verify credit was atomically refunded
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 4, "Lazy fetch must refund the 1 credit back to user");

    // Second fetch should not refund again
    await getDeckById(stuckDeck._id.toString(), user._id.toString());
    const userFinal = await User.findById(user._id);
    assert.equal(userFinal?.credits, 4, "Second lazy fetch must be idempotent");
  });

  it("I1: two concurrent first-start requests deduct exactly 1 credit", async () => {
    const user = await User.create({
      name: "Concurrent Charge User",
      email: "concurrent.charge@example.com",
      credits: 5,
      emailVerified: true,
      hasPurchased: true,
    });

    const deck = await Deck.create({
      userId: user._id,
      title: "Concurrent First Start Deck",
      status: "outlined",
      outline: [
        { id: "s1", title: "Slide 1", points: ["A"] },
        { id: "s2", title: "Slide 2", points: ["B"] },
      ],
      slides: [],
      creditCharged: false,
      creditRefunded: false,
    });

    // Launch two simultaneous first-start requests
    const [res1, res2] = await Promise.all([
      processSlideBatch(deck._id.toString(), user._id.toString()),
      processSlideBatch(deck._id.toString(), user._id.toString()),
    ]);

    // One request must win the atomic claim, the other must fail to claim
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 4, "Concurrent first-start calls must deduct exactly 1 credit in total");

    const deckAfter = await Deck.findById(deck._id);
    assert.equal(deckAfter?.creditCharged, true, "creditCharged must be set to true");
    assert.ok(deckAfter?.creditDeductedAt, "creditDeductedAt must be recorded on deck");

    const oneSucceeded = res1.status === 200 || res2.status === 200;
    const oneClaimRejected = res1.status === 409 || res2.status === 409 || (res1.data.inProgress || res2.data.inProgress);
    assert.ok(oneSucceeded, "At least one request must succeed in processing");
    assert.ok(oneClaimRejected, "The competing request must be rejected or locked out without double charge");
  });

  it("I1: insufficient credits leaves creditCharged false and the deck unchanged", async () => {
    const brokeUser = await User.create({
      name: "Zero Credits User",
      email: "zero.credits@example.com",
      credits: 0,
      emailVerified: true,
      hasPurchased: true,
    });

    const deck = await Deck.create({
      userId: brokeUser._id,
      title: "Deck With Zero Credits",
      status: "outlined",
      outline: [
        { id: "s1", title: "Slide 1", points: ["Point 1"] },
      ],
      slides: [],
      creditCharged: false,
      creditRefunded: false,
    });

    const res = await processSlideBatch(deck._id.toString(), brokeUser._id.toString());
    assert.equal(res.status, 402, "Must return 402 Insufficient credits");

    const deckAfter = await Deck.findById(deck._id);
    assert.equal(deckAfter?.creditCharged, false, "creditCharged must remain false");
    assert.equal(deckAfter?.status, "outlined", "Deck status must be restored to outlined");
    assert.equal(deckAfter?.slides?.length, 0, "No slides should be generated");
    assert.equal(deckAfter?.creditDeductedAt, undefined, "creditDeductedAt must not be set");

    const userAfter = await User.findById(brokeUser._id);
    assert.equal(userAfter?.credits, 0, "User credits must remain 0");
  });

  it("I1: a crash between claim and deduction is recoverable without false refund", async () => {
    const user = await User.create({
      name: "Crash Test User",
      email: "crash.test@example.com",
      credits: 3,
      emailVerified: true,
      hasPurchased: true,
    });

    // Simulate crash after step (a) claim: creditCharged is true, but step (b) deduction never ran, so creditDeductedAt is null/undefined
    const crashedDeck = await Deck.create({
      userId: user._id,
      title: "Crashed Mid-Claim Deck",
      status: "generating",
      outline: [{ id: "s1", title: "Slide 1", points: [] }],
      slides: [],
      creditCharged: true,
      creditRefunded: false,
      creditDeductedAt: undefined,
    });

    // Run refund guard
    const refunded = await executeAtomicRefund(crashedDeck._id, user._id);
    assert.equal(refunded, false, "Refund guard must NOT refund when creditDeductedAt does not exist");

    // Verify user credits remain untouched (user was never deducted, so should not get free credit)
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 3, "User credits must remain exactly 3 with no false refund");

    // The deck itself is marked failed
    const deckAfter = await Deck.findById(crashedDeck._id);
    assert.equal(deckAfter?.status, "failed");
    assert.equal(deckAfter?.creditRefunded, false);
  });

  it("I2: a deck taking 40 minutes total with updates every 2 minutes is never failed by lazy or cron recovery", async () => {
    const user = await User.create({
      name: "Long Progress User",
      email: "long.progress@example.com",
      credits: 5,
      emailVerified: true,
      hasPurchased: true,
    });

    // Deduct 1 credit for generation start
    await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });

    // Deck started 40 minutes ago
    const fortyMinsAgo = new Date(Date.now() - 40 * 60 * 1000);
    // But made progress 2 minutes ago
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);

    const activeDeck = await Deck.create({
      userId: user._id,
      title: "40-Minute Generating Deck",
      status: "generating",
      creditCharged: true,
      creditDeductedAt: fortyMinsAgo,
      creditRefunded: false,
      createdAt: fortyMinsAgo,
      updatedAt: twoMinsAgo,
      lastProgressAt: twoMinsAgo,
    });

    // Force timestamps in MongoDB collection
    await Deck.collection.updateOne(
      { _id: activeDeck._id },
      { $set: { createdAt: fortyMinsAgo, updatedAt: twoMinsAgo, lastProgressAt: twoMinsAgo } }
    );

    // 1. Lazy recovery check on GET /api/decks/[id]
    const fetched = await getDeckById(activeDeck._id.toString(), user._id.toString());
    assert.ok(fetched);
    assert.equal(fetched.status, "generating", "Actively progressing deck must NOT be marked failed by lazy recovery");
    assert.equal(fetched.creditRefunded, false, "Active deck must not be refunded");

    // 2. Cron cleanup check
    const STUCK_TIMEOUT_MS = 30 * 60 * 1000;
    const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
    const stuckDecks = await Deck.find({
      _id: activeDeck._id,
      status: { $in: ["outlining", "generating"] },
      $or: [
        { lastProgressAt: { $lt: stuckCutoff } },
        { lastProgressAt: { $in: [null, undefined] }, updatedAt: { $lt: stuckCutoff } },
      ],
    });
    assert.equal(stuckDecks.length, 0, "Actively progressing deck must NOT match cron stuck query");

    // Verify user credits remain 4 (no refund granted)
    const userFinal = await User.findById(user._id);
    assert.equal(userFinal?.credits, 4, "Credits must remain 4 while deck is actively generating");
  });

  it("I4: crash after deduction (user deduction recorded, but deck update interrupted) is recoverable and refunded", async () => {
    const user = await User.create({
      name: "Crash After Deduction User",
      email: "crash.after.deduction@example.com",
      credits: 2,
      emailVerified: true,
      hasPurchased: true,
    });

    const deck = await Deck.create({
      userId: user._id,
      title: "Interrupted Deck",
      status: "generating",
      outline: [{ id: "s1", title: "Slide 1", points: [] }],
      slides: [],
      creditCharged: true,
      creditRefunded: false,
      // Interrupted before creditDeductedAt was saved on deck!
      creditDeductedAt: undefined,
    });

    // But deduction DID happen on user before crash:
    const deductionId = "deduct-12345";
    await User.updateOne(
      { _id: user._id },
      {
        $inc: { credits: -1 },
        $push: {
          creditDeductions: {
            deductionId,
            deckId: deck._id,
            deductedAt: new Date(),
            refunded: false,
          },
        },
      }
    );

    const userBeforeRefund = await User.findById(user._id);
    assert.equal(userBeforeRefund?.credits, 1, "User credits was deducted to 1 before crash");

    // Execute atomic refund: should detect user's deduction record and refund 1 credit!
    const refundResult = await executeAtomicRefund(deck._id, user._id);
    assert.equal(refundResult, true, "Refund must succeed because deduction is recorded on user");

    const userAfterRefund = await User.findById(user._id);
    assert.equal(userAfterRefund?.credits, 2, "User credit must be restored to 2");
    assert.equal(userAfterRefund?.creditDeductions?.[0]?.refunded, true, "User deduction record must be marked refunded");

    // A duplicate refund call must not double refund
    const duplicateResult = await executeAtomicRefund(deck._id, user._id);
    assert.equal(duplicateResult, false, "Second refund attempt must be rejected");

    const userFinal = await User.findById(user._id);
    assert.equal(userFinal?.credits, 2, "Credits must remain 2 after duplicate attempt");
  });
});
