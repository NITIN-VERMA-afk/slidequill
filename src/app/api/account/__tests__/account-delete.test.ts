process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.APP_URL = process.env.APP_URL || "http://localhost:3000";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "@/app/models/User";
import Deck from "@/app/models/Deck";
import Session from "@/app/models/Session";
import Payment from "@/app/models/Payment";
import { POST, executeAccountDelete } from "../delete/route";
import { NextRequest } from "next/server";

describe("Account Deletion Route (/api/account/delete)", () => {
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

  it("rejects untrusted origin with 403 Forbidden in POST handler", async () => {
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "POST",
      headers: {
        origin: "https://malicious-attacker.com",
      },
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /Forbidden/);
  });

  it("local user: requires password and rejects incorrect password", async () => {
    const passwordHash = await bcrypt.hash("correct-pass-123", 10);
    const localUser = await User.create({
      name: "Local User",
      email: "local.user@example.com",
      authProvider: "local",
      passwordHash,
    });

    // 1. Missing password
    const missingRes = await executeAccountDelete({
      userId: localUser._id.toString(),
      password: "",
    });
    assert.equal(missingRes.status, 400);
    assert.equal(missingRes.data.error, "Password required");

    // 2. Incorrect password
    const wrongRes = await executeAccountDelete({
      userId: localUser._id.toString(),
      password: "wrong-password",
    });
    assert.equal(wrongRes.status, 403);
    assert.equal(wrongRes.data.error, "Incorrect password");

    // Verify user still exists
    const stillThere = await User.findById(localUser._id);
    assert.ok(stillThere);
  });

  it("local user: deletes account and associated data with correct password", async () => {
    const passwordHash = await bcrypt.hash("secret-pass-456", 10);
    const user = await User.create({
      name: "Delete Me",
      email: "delete.me@example.com",
      authProvider: "local",
      passwordHash,
    });

    await Deck.create({ userId: user._id, title: "Deck to delete" });
    await Session.create({
      userId: user._id,
      tokenHash: "token-hash-1",
      expiresAt: new Date(Date.now() + 100000),
    });
    const payment = await Payment.create({
      userId: user._id,
      razorpayOrderId: "order_123",
      planId: "credits_20",
      credits: 20,
      amountPaise: 19900,
    });

    const successRes = await executeAccountDelete({
      userId: user._id.toString(),
      password: "secret-pass-456",
    });
    assert.equal(successRes.status, 200);
    assert.equal(successRes.data.success, true);

    // Verify user deleted
    const deletedUser = await User.findById(user._id);
    assert.equal(deletedUser, null);

    // Verify decks & sessions deleted
    const decks = await Deck.find({ userId: user._id });
    assert.equal(decks.length, 0);

    const sessions = await Session.find({ userId: user._id });
    assert.equal(sessions.length, 0);

    // Verify payment was anonymized (userId unset)
    const checkPayment = await Payment.findById(payment._id);
    assert.equal(checkPayment?.userId, undefined);
  });

  it("google oauth user: requires email confirmation and skips password check without crashing", async () => {
    const googleUser = await User.create({
      name: "Google User",
      email: "google.user@example.com",
      authProvider: "google",
      googleId: "google-sub-987654",
      // No passwordHash
    });

    // 1. Missing or wrong email confirmation
    const wrongConfirm = await executeAccountDelete({
      userId: googleUser._id.toString(),
      emailConfirmation: "wrong@example.com",
    });
    assert.equal(wrongConfirm.status, 400);
    assert.match(wrongConfirm.data.error, /enter your email address/);

    // 2. Correct email confirmation succeeds without checking password
    const correctConfirm = await executeAccountDelete({
      userId: googleUser._id.toString(),
      emailConfirmation: "google.user@example.com",
    });
    assert.equal(correctConfirm.status, 200);
    assert.equal(correctConfirm.data.success, true);

    const checkUser = await User.findById(googleUser._id);
    assert.equal(checkUser, null);
  });
});
