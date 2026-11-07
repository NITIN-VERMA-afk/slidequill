process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.APP_URL = "http://localhost:3000";

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { POST as webhookPost } from "../webhook/route";
import Payment from "@/app/models/Payment";
import User from "@/app/models/User";

describe("Razorpay Webhook Route (/api/billing/webhook)", () => {
  let mongoServer: MongoMemoryServer;
  const TEST_SECRET = "whsec_test_razorpay_secret_123456789";

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

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;
  });

  it("returns 400 Bad Request when x-razorpay-signature header is missing", async () => {
    const payload = JSON.stringify({ event: "payment.captured" });
    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Missing signature");
  });

  it("returns 500 when RAZORPAY_WEBHOOK_SECRET is unset", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const payload = JSON.stringify({ event: "payment.captured" });
    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": "some_dummy_signature",
      },
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, "RAZORPAY_WEBHOOK_SECRET is unset");
  });

  it("returns 400 when signature is too short (never throws RangeError)", async () => {
    const payload = JSON.stringify({ event: "payment.captured" });
    const shortSignature = "short_sig_123";

    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": shortSignature,
      },
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid signature");
  });

  it("returns 400 when signature is too long (never throws RangeError)", async () => {
    const payload = JSON.stringify({ event: "payment.captured" });
    const longSignature = "a".repeat(128); // 128 characters instead of 64

    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": longSignature,
      },
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid signature");
  });

  it("returns 400 when signature has equal length (64 chars) but wrong hash", async () => {
    const payload = JSON.stringify({ event: "payment.captured" });
    // 64-char hex string with invalid hash content
    const wrongSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": wrongSignature,
      },
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid signature");
  });

  it("processes payment.captured event with valid HMAC-SHA256 signature and credits user", async () => {
    const user = await User.create({
      name: "Webhook User",
      email: "webhook.test.user@example.com",
      credits: 3,
      hasPurchased: false,
    });

    const payment = await Payment.create({
      userId: user._id,
      razorpayOrderId: "order_test_hook_987",
      planId: "credits_20",
      credits: 20,
      amountPaise: 19900,
      status: "pending",
    });

    const payload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test_payment_456",
            order_id: "order_test_hook_987",
            amount: 19900,
            status: "captured",
          },
        },
      },
    });

    // Compute legitimate signature
    const validSignature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(payload)
      .digest("hex");

    const req = new NextRequest("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": validSignature,
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await webhookPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "ok");

    // Verify payment updated to paid
    const updatedPayment = await Payment.findById(payment._id);
    assert.equal(updatedPayment?.status, "paid");
    assert.equal(updatedPayment?.razorpayPaymentId, "pay_test_payment_456");

    // Verify user received 20 credits and hasPurchased set
    const updatedUser = await User.findById(user._id);
    assert.equal(updatedUser?.credits, 23);
    assert.equal(updatedUser?.hasPurchased, true);
  });
});
