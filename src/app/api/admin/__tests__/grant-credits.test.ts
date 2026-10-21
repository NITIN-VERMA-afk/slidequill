process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-mock-key-12345678901234567890";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "@/app/models/User";
import AdminAuditLog from "@/app/models/AdminAuditLog";
import { executeAdminCreditGrant } from "../grant-credits/route";

describe("Admin Grant-Credits Tool & Audit Log (Real In-Memory DB)", () => {
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

  it("rejects non-admin users with 403 Forbidden", async () => {
    // 1. Create standard (non-admin) user
    const standardUser = await User.create({
      name: "Normal User",
      email: "normal.user@example.com",
      role: "user",
      credits: 5,
    });

    const targetUser = await User.create({
      name: "Target User",
      email: "target.user@example.com",
      role: "user",
      credits: 2,
    });

    // Attempt grant as normal user
    const res = await executeAdminCreditGrant({
      adminId: standardUser._id.toString(),
      email: targetUser.email,
      amount: 10,
      note: "Illegal grant attempt",
    });

    assert.equal(res.status, 403);
    assert.match(res.data.error, /Forbidden: Admin access required/);

    // Verify credits were NOT modified
    const targetCheck = await User.findById(targetUser._id);
    assert.equal(targetCheck?.credits, 2);

    // Verify NO audit log was written
    const logs = await AdminAuditLog.find({ userId: targetUser._id });
    assert.equal(logs.length, 0);
  });

  it("atomically grants credits, writes audit log, and returns trimmed { email, credits } response", async () => {
    // 1. Create admin user
    const adminUser = await User.create({
      name: "Super Admin",
      email: "super.admin@example.com",
      role: "admin",
      credits: 100,
    });

    // 2. Create customer recipient
    const customer = await User.create({
      name: "Valued Customer",
      email: "valued.customer@example.com",
      role: "user",
      credits: 7,
    });

    const grantAmount = 25;
    const auditNote = "Support goodwill credit compensation for deck render delay";

    // 3. Execute credit grant
    const res = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: customer.email,
      amount: grantAmount,
      note: auditNote,
    });

    assert.equal(res.status, 200);

    // 4. Verify trimmed response: must contain ONLY email and credits (never full user doc or ids)
    assert.deepEqual(Object.keys(res.data).sort(), ["credits", "email"].sort());
    assert.equal(res.data.email, customer.email);
    assert.equal(res.data.credits, 32); // 7 + 25 = 32
    assert.equal((res.data as any)._id, undefined);
    assert.equal((res.data as any).password, undefined);
    assert.equal((res.data as any).role, undefined);

    // 5. Verify target user credit balance in database ($inc atomic verification)
    const customerAfter = await User.findById(customer._id);
    assert.equal(customerAfter?.credits, 32);

    // 6. Verify audit log entry in database
    const auditLogs = await AdminAuditLog.find({ userId: customer._id });
    assert.equal(auditLogs.length, 1);
    const auditLog = auditLogs[0];
    assert.equal(auditLog.adminId.toString(), adminUser._id.toString());
    assert.equal(auditLog.userId.toString(), customer._id.toString());
    assert.equal(auditLog.amount, 25);
    assert.equal(auditLog.note, auditNote);
    assert.ok(auditLog.timestamp instanceof Date, "Timestamp must be a valid Date");
    assert.equal(auditLog.action, "grant_credits");
  });

  it("enforces 100-credit cap per transaction", async () => {
    const adminUser = await User.create({
      name: "Admin Cap Tester",
      email: "admin.cap@example.com",
      role: "admin",
    });

    const customer = await User.create({
      name: "Cap Customer",
      email: "cap.customer@example.com",
      role: "user",
      credits: 10,
    });

    // 101 credits must be rejected by the cap
    const resOverCap = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: customer.email,
      amount: 101,
      note: "Too large grant",
    });
    assert.equal(resOverCap.status, 400);
    assert.match(resOverCap.data.error, /cannot exceed 100 credits/);

    // Verify credits unchanged
    const customerCheck = await User.findById(customer._id);
    assert.equal(customerCheck?.credits, 10);

    // Exactly 100 credits must be accepted
    const resExact100 = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: customer.email,
      amount: 100,
      note: "Maximum allowed grant",
    });
    assert.equal(resExact100.status, 200);
    assert.equal(resExact100.data.credits, 110);
  });

  it("rejects invalid amounts or non-existent user emails", async () => {
    const adminUser = await User.create({
      name: "Admin Two",
      email: "admin2@example.com",
      role: "admin",
    });

    // Non-existent target email
    const resNotFound = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: "nobody@nowhere-domain.com",
      amount: 10,
    });
    assert.equal(resNotFound.status, 404);
    assert.match(resNotFound.data.error, /User not found/);

    // Negative or non-integer amount
    const resNegative = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: "super.admin@example.com",
      amount: -5,
    });
    assert.equal(resNegative.status, 400);

    const resZero = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: "super.admin@example.com",
      amount: 0,
    });
    assert.equal(resZero.status, 400);

    const resDecimal = await executeAdminCreditGrant({
      adminId: adminUser._id.toString(),
      email: "super.admin@example.com",
      amount: 10.5,
    });
    assert.equal(resDecimal.status, 400);
  });
});
