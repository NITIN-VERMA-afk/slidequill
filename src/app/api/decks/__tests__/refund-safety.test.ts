// Set test env vars before importing application modules
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "@/app/models/User";
import Deck from "@/app/models/Deck";
import { executeAtomicRefund } from "../[id]/generate/route";

describe("Refund Safety & Exactly-Once Guarantees (Real In-Memory DB)", () => {
  let mongoServer: MongoMemoryServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  after(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it("forces generation failure and verifies exactly-once refund on a charged deck", async () => {
    // 1. Create user with 2 credits
    const user = await User.create({
      name: "Alice Tester",
      email: "alice.refund@example.com",
      credits: 2,
      emailVerified: true,
      hasPurchased: true,
    });

    // 2. Charge 1 credit and create generating deck
    await User.updateOne({ _id: user._id }, { $inc: { credits: -1 } });
    const deck = await Deck.create({
      userId: user._id,
      title: "Quarterly Strategy",
      status: "generating",
      creditCharged: true,
      creditRefunded: false,
    });

    const userBefore = await User.findById(user._id);
    assert.equal(userBefore?.credits, 1);

    // 3. Force failure and trigger atomic refund
    const refundSuccess = await executeAtomicRefund(deck._id, user._id);
    assert.equal(refundSuccess, true, "First refund attempt must succeed");

    // 4. Verify user credit incremented back to 2
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 2, "User must receive exactly 1 credit back");

    // 5. Verify deck state
    const deckAfter = await Deck.findById(deck._id);
    assert.equal(deckAfter?.creditRefunded, true);
    assert.equal(deckAfter?.status, "failed");

    // 6. Attempt second refund on same deck -> must NOT refund again
    const secondRefund = await executeAtomicRefund(deck._id, user._id);
    assert.equal(secondRefund, false, "Second refund attempt must be rejected");

    const userFinal = await User.findById(user._id);
    assert.equal(userFinal?.credits, 2, "Credits must remain 2 after duplicate attempt");
  });

  it("never refunds paid credits for free-tier decks (creditCharged === false)", async () => {
    // 1. Free-tier user with 3 free credits
    const freeUser = await User.create({
      name: "Bob FreeUser",
      email: "bob.free@example.com",
      credits: 3,
      emailVerified: true,
      hasPurchased: false,
    });

    // 2. Free deck generation: creditCharged is false
    const freeDeck = await Deck.create({
      userId: freeUser._id,
      title: "Free Pitch Deck",
      status: "generating",
      creditCharged: false,
      creditRefunded: false,
    });

    // 3. Failure occurs
    const refunded = await executeAtomicRefund(freeDeck._id, freeUser._id);
    assert.equal(refunded, false, "Free deck must not be eligible for credit refund");

    // 4. Verify credits remain exactly 3 (no free credit inflation)
    const userAfter = await User.findById(freeUser._id);
    assert.equal(userAfter?.credits, 3);

    const deckAfter = await Deck.findById(freeDeck._id);
    assert.equal(deckAfter?.creditRefunded, false);
    assert.equal(deckAfter?.status, "failed");
  });

  it("never refunds decks with status 'ready'", async () => {
    // 1. Paid user
    const user = await User.create({
      name: "Carol Producer",
      email: "carol.ready@example.com",
      credits: 5,
      emailVerified: true,
      hasPurchased: true,
    });

    // 2. Deck was successfully generated and is "ready"
    const readyDeck = await Deck.create({
      userId: user._id,
      title: "Finished Presentation",
      status: "ready",
      creditCharged: true,
      creditRefunded: false,
    });

    // 3. Malicious or late failure handler calls refund on ready deck
    const refunded = await executeAtomicRefund(readyDeck._id, user._id);
    assert.equal(refunded, false, "Ready deck must never be refunded");

    // 4. Verify user credits unchanged and deck remains ready
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 5);

    const deckAfter = await Deck.findById(readyDeck._id);
    assert.equal(deckAfter?.status, "ready");
    assert.equal(deckAfter?.creditRefunded, false);
  });

  it("concurrent double-refund race test: exactly-once refund succeeds", async () => {
    // 1. User starting with 0 credits
    const user = await User.create({
      name: "Dave Concurrency",
      email: "dave.race@example.com",
      credits: 0,
      emailVerified: true,
      hasPurchased: true,
    });

    // 2. Generating deck charged 1 credit
    const deck = await Deck.create({
      userId: user._id,
      title: "High Concurrency Test",
      status: "generating",
      creditCharged: true,
      creditRefunded: false,
    });

    // 3. Trigger TWO simultaneous refunds in parallel (simulating race conditions)
    const [res1, res2] = await Promise.all([
      executeAtomicRefund(deck._id, user._id),
      executeAtomicRefund(deck._id, user._id),
    ]);

    // Exactly one should succeed, exactly one should fail
    const successes = [res1, res2].filter(Boolean).length;
    assert.equal(successes, 1, "Exactly one concurrent refund attempt must succeed");

    // 4. Verify user credits is strictly 1 (NOT 2)
    const userAfter = await User.findById(user._id);
    assert.equal(userAfter?.credits, 1, "User credits must be incremented exactly once");

    // 5. Verify deck creditRefunded is true
    const deckAfter = await Deck.findById(deck._id);
    assert.equal(deckAfter?.creditRefunded, true);
  });
});
