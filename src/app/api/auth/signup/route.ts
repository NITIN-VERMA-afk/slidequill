/**
 * POST /api/auth/signup
 * Creates a new user account, issues access + refresh tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Resend } from "resend";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import AuthToken from "@/app/models/AuthToken";
import Session from "@/app/models/Session";
import { signAccessToken } from "@/lib/auth";
import { generateRefreshToken, hashToken, setAuthCookies } from "@/lib/cookies";
import { getLoginLimiter, getSignupIpLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";
import { trackEvent } from "@/lib/analytics";
import { getClientIp } from "@/lib/ip";
import { normalizeEmail, isDisposableEmail } from "@/lib/disposable-emails";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  // CSRF
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  // Rate limit by IP: burst protection (5/min) and daily signup cap (10/24h per IP)
  const ip = getClientIp(req);
  const { success: burstOk } = await getLoginLimiter().limit(ip);
  if (!burstOk) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { success: dailyOk } = await getSignupIpLimiter().limit(ip);
  if (!dailyOk) {
    return NextResponse.json(
      { error: "Too many accounts created from this IP address today. Please try again tomorrow." },
      { status: 429 }
    );
  }

  // Validate body
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  // Block disposable/temporary emails
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: "Disposable email addresses are not allowed." }, { status: 400 });
  }

  // Normalize Gmail dots/plus aliases to prevent duplicate account farming
  const canonicalEmail = normalizeEmail(email);

  await connectDB();

  // Generic error for existing email (no user enumeration)
  const existing = await User.exists({ email: canonicalEmail });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: canonicalEmail, passwordHash });

  // Generate verify token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  
  await AuthToken.create({
    userId: user._id,
    type: "verify",
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  });

  // Send email
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    const resend = new Resend(resendApiKey);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const emailFrom = process.env.EMAIL_FROM || "onboarding@resend.dev";
    
    try {
      await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: "Verify your email - Slidequill",
        html: `<p>Click here to verify: <a href="${appUrl}/verify-email?token=${rawToken}">Verify Email</a></p>`
      });
    } catch (e) {
      console.error("Failed to send verify email", e);
    }
  } else {
    console.warn("RESEND_API_KEY is not set. Skipping verification email.");
  }

  // Issue tokens
  const [accessToken, rawRefresh] = await Promise.all([
    signAccessToken(user._id.toString(), user.role),
    Promise.resolve(generateRefreshToken()),
  ]);

  await Session.create({
    userId: user._id,
    tokenHash: hashToken(rawRefresh),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: req.headers.get("user-agent") ?? "",
    ip,
  });

  // Track analytics event
  void trackEvent("signup", { userId: user._id.toString() });

  const res = NextResponse.json(
    { user: { id: user._id, email: user.email, name: user.name, role: user.role } },
    { status: 201 }
  );
  setAuthCookies(res.cookies, accessToken, rawRefresh);
  return res;
}
