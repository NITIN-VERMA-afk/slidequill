import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/db";
import AuthToken from "@/app/models/AuthToken";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "sq:rl:resendverify",
  });
  const { success } = await limiter.limit(session.sub);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  await connectDB();
  const user = await User.findById(session.sub);
  if (!user || user.emailVerified) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Invalidate old tokens
  await AuthToken.deleteMany({ userId: user._id, type: "verify" });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  
  await AuthToken.create({
    userId: user._id,
    type: "verify",
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
  
  try {
    await resend.emails.send({
      from: emailFrom,
      to: user.email,
      subject: "Verify your email - Slidequill",
      html: `<p>Click here to verify: <a href="${appUrl}/verify-email?token=${rawToken}">Verify Email</a></p>`
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
