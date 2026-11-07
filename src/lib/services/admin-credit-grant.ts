import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import AdminAuditLog from "@/app/models/AdminAuditLog";

export async function executeAdminCreditGrant({
  adminId,
  email,
  amount,
  note,
}: {
  adminId: string;
  email: string;
  amount: number;
  note?: string;
}): Promise<{ status: number; data: any }> {
  await connectDB();

  const admin = await User.findById(adminId).select("role email").lean();
  if (!admin || admin.role !== "admin") {
    return { status: 403, data: { error: "Forbidden: Admin access required." } };
  }

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return { status: 400, data: { error: "Valid email address is required." } };
  }

  const parsedAmount = Number(amount);
  if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
    return { status: 400, data: { error: "Amount must be a positive integer." } };
  }
  if (parsedAmount > 100) {
    return { status: 400, data: { error: "Credit grant cannot exceed 100 credits per transaction." } };
  }

  const targetUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (!targetUser) {
    return { status: 404, data: { error: "User not found with this email." } };
  }

  // Atomic credit increment
  const updatedUser = await User.findOneAndUpdate(
    { _id: targetUser._id },
    { $inc: { credits: parsedAmount } },
    { returnDocument: "after" }
  );

  const timestamp = new Date();
  await AdminAuditLog.create({
    adminId,
    userId: targetUser._id,
    action: "grant_credits",
    amount: parsedAmount,
    timestamp,
    note: (note || "").slice(0, 500),
  });

  return {
    status: 200,
    data: {
      email: targetUser.email,
      credits: updatedUser?.credits,
    },
  };
}

