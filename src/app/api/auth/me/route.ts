/**
 * GET  /api/auth/me   — current user profile
 * PATCH /api/auth/me  — update name and/or password
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { verifyAccessToken, findSession, signAccessToken } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";

async function getUser(req: NextRequest) {
  const token = req.cookies.get("sq_at")?.value;
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload?.sub) {
      await connectDB();
      const user = await User.findById(payload.sub);
      if (user) return user;
    }
  }

  // Fallback: check refresh token
  const rawRefresh = req.cookies.get("sq_rt")?.value;
  if (rawRefresh) {
    await connectDB();
    const session = await findSession(rawRefresh);
    if (session?.userId) {
      return User.findById(session.userId);
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const res = NextResponse.json({
    user: { email: user.email, name: user.name, role: user.role, credits: user.credits, emailVerified: user.emailVerified },
  });

  // Re-issue access token if it was missing or expired
  const token = req.cookies.get("sq_at")?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload) {
    const newAccessToken = await signAccessToken(user._id.toString(), user.role);
    res.cookies.set("sq_at", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 15,
    });
  }

  return res;
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, currentPassword, newPassword } = parsed.data;

  if (name) user.name = name;

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  await user.save();
  return NextResponse.json({ ok: true, name: user.name });
}
