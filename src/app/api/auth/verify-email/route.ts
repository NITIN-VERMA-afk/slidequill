import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/db";
import AuthToken from "@/app/models/AuthToken";
import User from "@/app/models/User";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await connectDB();
    const authToken = await AuthToken.findOne({ tokenHash, type: "verify" });

    if (!authToken || authToken.usedAt || authToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    authToken.usedAt = new Date();
    await authToken.save();

    await User.updateOne({ _id: authToken.userId }, { $set: { emailVerified: true } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to verify" }, { status: 500 });
  }
}
