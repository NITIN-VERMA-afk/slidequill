process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.CRON_SECRET = process.env.CRON_SECRET || "test-cron-secret-12345";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import AuthToken from "@/app/models/AuthToken";
import { GET as cronCleanup, executeCleanupJob } from "../cleanup/route";

describe("Cron Cleanup Safety & Retention (GET /api/cron/cleanup)", () => {
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

  it("rejects unauthorized calls when CRON_SECRET header is missing or incorrect", async () => {
    // Missing header
    const reqNoAuth = new NextRequest("http://localhost/api/cron/cleanup");
    const resNoAuth = await cronCleanup(reqNoAuth);
    assert.equal(resNoAuth.status, 401);

    // Wrong token
    const reqWrongAuth = new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const resWrongAuth = await cronCleanup(reqWrongAuth);
    assert.equal(resWrongAuth.status, 401);
  });

  it("unsets expired sourceText and sourceName while preserving entire deck and active decks", async () => {
    const user = await User.create({
      name: "Retention Test User",
      email: "retention@example.com",
    });

    // 1. Expired deck (sourceExpiresAt in the past)
    const expiredDeck = await Deck.create({
      userId: user._id,
      title: "Expired Deck",
      sourceText: "This source text should be deleted after 30 days.",
      sourceName: "expired_contract.pdf",
      sourceExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
      status: "ready",
      slides: [
        {
          id: "slide-1",
          layout: "title",
          title: "Important Deck",
          content: {},
          notes: "Speaker notes",
        },
      ],
    });

    // 2. Active deck (sourceExpiresAt in the future)
    const activeDeck = await Deck.create({
      userId: user._id,
      title: "Active Deck",
      sourceText: "This source text must be retained.",
      sourceName: "active_document.pdf",
      sourceExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // in 15 days
      status: "ready",
      slides: [
        {
          id: "slide-2",
          layout: "bullets",
          title: "Active Slide",
          content: { bullets: ["Item 1"] },
          notes: "",
        },
      ],
    });

    // 3. Stale AuthToken
    await AuthToken.create({
      userId: user._id,
      type: "verify",
      tokenHash: "used-token-hash-abc",
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: new Date(Date.now() - 1000),
    });

    // Run cleanup via authorized HTTP endpoint
    const reqAuth = new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const res = await cronCleanup(reqAuth);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.decksCleaned >= 1, true);

    // Verify expired deck: sourceText and sourceName are unset, but deck & slides remain
    const checkExpired = await Deck.findById(expiredDeck._id).select("+sourceText").lean();
    assert.ok(checkExpired, "Expired deck document must NOT be deleted");
    assert.equal(checkExpired.sourceText, undefined, "sourceText must be unset");
    assert.equal(checkExpired.sourceName, undefined, "sourceName must be unset");
    assert.equal(checkExpired.slides.length, 1, "Slides must be preserved");
    assert.equal(checkExpired.title, "Expired Deck");

    // Verify active deck: sourceText and sourceName remain intact
    const checkActive = await Deck.findById(activeDeck._id).select("+sourceText").lean();
    assert.ok(checkActive, "Active deck document must exist");
    assert.equal(checkActive.sourceText, "This source text must be retained.");
    assert.equal(checkActive.sourceName, "active_document.pdf");
    assert.equal(checkActive.slides.length, 1);

    // Verify used AuthToken was cleaned
    const tokenCount = await AuthToken.countDocuments({ tokenHash: "used-token-hash-abc" });
    assert.equal(tokenCount, 0, "Used token must be deleted");
  });

  it("executeCleanupJob runs cleanly when no decks or tokens are expired", async () => {
    const result = await executeCleanupJob();
    assert.equal(typeof result.decksCleaned, "number");
    assert.equal(typeof result.tokensCleaned, "number");
  });
});


