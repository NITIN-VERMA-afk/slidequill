/**
 * POST /api/auth/signup
 * Creates a new user account, issues access + refresh tokens.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import Session from "@/app/models/Session";
import { signAccessToken } from "@/lib/auth";
import { generateRefreshToken, hashToken, setAuthCookies } from "@/lib/cookies";
import { getLoginLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  // CSRF
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await getLoginLimiter().limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
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

  await connectDB();

  // Generic error for existing email (no user enumeration)
  const existing = await User.exists({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Could not create account. Please try again." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });

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

  const res = NextResponse.json(
    { user: { id: user._id, email: user.email, name: user.name, role: user.role } },
    { status: 201 }
  );
  setAuthCookies(res.cookies, accessToken, rawRefresh);
  return res;
}
