process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "@/app/models/User";
import Deck from "@/app/models/Deck";
import { deleteDeckSourceText } from "../[id]/source/route";

describe("Source Text Deletion Logic (deleteDeckSourceText)", () => {
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

  it("permanently unsets sourceText and sourceName for the deck owner", async () => {
    const user = await User.create({
      name: "Privacy User",
      email: "privacy.user@example.com",
      credits: 5,
      emailVerified: true,
    });

    const deck = await Deck.create({
      userId: user._id,
      title: "Confidential Strategy",
      sourceText: "Extremely sensitive corporate strategy data that must not be retained.",
      sourceName: "confidential_strategy.pdf",
      status: "ready",
      slides: [
        {
          id: "slide-1",
          layout: "bullets",
          title: "Public Slide",
          content: { bullets: ["Point 1"] },
          notes: "",
        },
      ],
    });

    // Verify initial state
    const beforeDb = await Deck.findById(deck._id).select("+sourceText").lean();
    assert.equal(beforeDb?.sourceText, "Extremely sensitive corporate strategy data that must not be retained.");
    assert.equal(beforeDb?.sourceName, "confidential_strategy.pdf");

    // Execute deletion
    const result = await deleteDeckSourceText(deck._id.toString(), user._id.toString());
    assert.equal(result.success, true);
    assert.equal(result.status, 200);

    // Verify directly in MongoDB that fields are unset
    const updatedInDb = await Deck.findById(deck._id).select("+sourceText").lean();
    assert.equal(updatedInDb?.sourceText, undefined);
    assert.equal(updatedInDb?.sourceName, undefined);
    // Outline and slides are still intact
    assert.equal(updatedInDb?.slides?.length, 1);
  });

  it("rejects deletion while deck status is outlining", async () => {
    const user = await User.create({
      name: "Outlining User",
      email: "outlining.user@example.com",
      credits: 5,
    });

    const deck = await Deck.create({
      userId: user._id,
      title: "Active Deck",
      sourceText: "Document currently being parsed.",
      status: "outlining",
    });

    const result = await deleteDeckSourceText(deck._id.toString(), user._id.toString());
    assert.equal(result.success, false);
    assert.equal(result.status, 400);
    assert.equal(result.error?.includes("while outline generation is in progress"), true);

    // Verify sourceText remains intact while outlining
    const stillThere = await Deck.findById(deck._id).select("+sourceText").lean();
    assert.equal(stillThere?.sourceText, "Document currently being parsed.");
  });

  it("rejects deletion when requested by a different user", async () => {
    const owner = await User.create({
      name: "Deck Owner",
      email: "owner@example.com",
    });
    const attacker = await User.create({
      name: "Attacker User",
      email: "attacker@example.com",
    });

    const deck = await Deck.create({
      userId: owner._id,
      title: "Protected Deck",
      sourceText: "Private text.",
      status: "ready",
    });

    const result = await deleteDeckSourceText(deck._id.toString(), attacker._id.toString());
    assert.equal(result.success, false);
    assert.equal(result.status, 404);

    // Verify sourceText was not deleted by the unauthorized user
    const stillThere = await Deck.findById(deck._id).select("+sourceText").lean();
    assert.equal(stillThere?.sourceText, "Private text.");
  });
});
