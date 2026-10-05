/**
 * POST /api/auth/login
 * Authenticates a user, issues access + refresh tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import Session from "@/app/models/Session";
import { signAccessToken } from "@/lib/auth";
import { generateRefreshToken, hashToken, setAuthCookies } from "@/lib/cookies";
import { getLoginLimiter, getEmailLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const INVALID_CREDENTIALS = { error: "Invalid credentials." };

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit by IP
  const ipLimit = await getLoginLimiter().limit(ip);
  if (!ipLimit.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // Rate limit by email (stricter)
  const emailLimit = await getEmailLimiter().limit(email);
  if (!emailLimit.success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  await connectDB();
  const user = await User.findOne({ email }).select("+passwordHash");

  // Always run bcrypt to prevent timing attacks revealing account existence
  const fakeHash = "$2b$12$invalidhashfortimingattackprevention000000000000000000";
  const passwordToCheck = user?.passwordHash ?? fakeHash;
  const valid = await bcrypt.compare(password, passwordToCheck);

  if (!user || !valid) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

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

  const res = NextResponse.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      credits: user.credits,
    },
  });
  setAuthCookies(res.cookies, accessToken, rawRefresh);
  return res;
}
