process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.APP_URL = "http://localhost:3000";

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { POST as verifyPost } from "../verify/route";
import { signAccessToken, __setMockHeaders } from "@/lib/auth";

describe("Payment Verification Route (/api/billing/verify)", () => {
  const TEST_SECRET = "test_razorpay_key_secret_123456";
  const ORDER_ID = "order_test_987654321";
  const PAYMENT_ID = "pay_test_123456789";

  async function setAuthUser(userId = "user_test_verify", role: "user" | "admin" = "user") {
    const token = await signAccessToken(userId, role);
    __setMockHeaders({
      cookies: async () => ({
        get: (name: string) => (name === "sq_at" ? { value: token } : undefined),
      }),
      headers: async () => ({
        get: () => null,
      }),
    });
  }

  beforeEach(async () => {
    process.env.RAZORPAY_KEY_SECRET = TEST_SECRET;
    await setAuthUser();
  });

  afterEach(() => {
    __setMockHeaders(null);
  });

  it("returns 401 Unauthorized when user session is missing", async () => {
    __setMockHeaders(null);

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: "some_sig",
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.error, "Unauthorized.");
  });

  it("returns 400 when missing required parameters", async () => {
    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Missing parameters");
  });

  it("returns 500 when RAZORPAY_KEY_SECRET is unset", async () => {
    delete process.env.RAZORPAY_KEY_SECRET;

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: "some_sig",
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, "Config error");
  });

  it("passes with 200 and success: true for a valid signature", async () => {
    const validSignature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${ORDER_ID}|${PAYMENT_ID}`)
      .digest("hex");

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: validSignature,
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it("rejects wrong signature of the same length with 400", async () => {
    // 64-char hexadecimal string matching sha256 output length
    const wrongSignature = "0".repeat(64);

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: wrongSignature,
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid payment signature");
  });

  it("rejects short wrong-length signature with 400 without throwing RangeError", async () => {
    const shortSignature = "short_invalid_sig";

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: shortSignature,
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid payment signature");
  });

  it("rejects long wrong-length signature with 400 without throwing RangeError", async () => {
    const longSignature = "f".repeat(128);

    const req = new NextRequest("http://localhost:3000/api/billing/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: ORDER_ID,
        razorpay_payment_id: PAYMENT_ID,
        razorpay_signature: longSignature,
      }),
    });

    const res = await verifyPost(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, "Invalid payment signature");
  });
});

