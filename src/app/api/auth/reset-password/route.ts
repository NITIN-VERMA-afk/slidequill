import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/app/lib/db";
import AuthToken from "@/app/models/AuthToken";
import User from "@/app/models/User";
import Session from "@/app/models/Session";

const schema = z.object({
  token: z.string(),
  password: z.string().min(8).max(72),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { token, password } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await connectDB();
    const authToken = await AuthToken.findOne({ tokenHash, type: "reset" });

    if (!authToken || authToken.usedAt || authToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: authToken.userId }, { $set: { passwordHash } });

    // Mark used
    authToken.usedAt = new Date();
    await authToken.save();

    // Invalidate all existing sessions
    await Session.deleteMany({ userId: authToken.userId });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
