import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/db";
import AuthToken from "@/app/models/AuthToken";
import User from "@/app/models/User";
import { Resend } from "resend";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { email } = await req.json().catch(() => ({ email: "" }));
  
  if (!email) return NextResponse.json({ success: true }); // Prevent enum

  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: `sq:rl:forgot:${ip}:${email}`,
  });
  
  const { success: rateSuccess } = await limiter.limit(ip);
  if (!rateSuccess) {
    return NextResponse.json({ success: true }); // Return same to prevent probing
  }

  await connectDB();
  const user = await User.findOne({ email: email.toLowerCase() });
  
  if (user) {
    // Invalidate old resets
    await AuthToken.deleteMany({ userId: user._id, type: "reset" });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    
    await AuthToken.create({
      userId: user._id,
      type: "reset",
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
    
    try {
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Reset your password - Slidequill",
        html: `<p>Click here to reset your password: <a href="${appUrl}/reset-password?token=${rawToken}">Reset Password</a></p>`
      });
    } catch (e) {
      console.error(e);
    }
  }

  // Always return success
  return NextResponse.json({ success: true });
}
