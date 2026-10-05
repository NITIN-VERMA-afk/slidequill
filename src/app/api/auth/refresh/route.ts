/**
 * POST /api/auth/refresh
 * Rotates the refresh token and issues a new access token.
 * Replay detection: if the token hash is not found but was recently issued,
 * revoke all sessions for the user.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Session from "@/app/models/Session";
import {
  signAccessToken,
  revokeAllSessions,
  findSession,
} from "@/lib/auth";
import {
  generateRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/cookies";
import { getLoginLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = await getLoginLimiter().limit(`refresh:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawToken = req.cookies.get("sq_rt")?.value;
  if (!rawToken) {
    return NextResponse.json({ error: "No refresh token." }, { status: 401 });
  }

  await connectDB();
  const session = await findSession(rawToken);

  if (!session) {
    // Token not found — could be replay of an already-rotated token.
    // Find any session for this userId by decoding nothing (we don't have userId here).
    // Instead, look for ANY session with this hash (even if expired) to detect replay.
    const hash = hashToken(rawToken);
    const staleSession = await Session.findOne({ tokenHash: hash });
    if (staleSession) {
      // This token existed but is expired/rotated — revoke all sessions for that user
      await revokeAllSessions(staleSession.userId.toString());
      const res = NextResponse.json(
        { error: "Session compromised. Please log in again." },
        { status: 401 }
      );
      clearAuthCookies(res.cookies);
      return res;
    }
    const res = NextResponse.json({ error: "Invalid refresh token." }, { status: 401 });
    clearAuthCookies(res.cookies);
    return res;
  }

  // Rotate: delete old session, create new one
  const userId = session.userId.toString();
  const role = (await import("@/app/models/User").then((m) =>
    m.default.findById(userId).select("role").lean()
  )) as { role: "user" | "admin" } | null;

  if (!role) {
    await Session.deleteOne({ _id: session._id });
    const res = NextResponse.json({ error: "User not found." }, { status: 401 });
    clearAuthCookies(res.cookies);
    return res;
  }

  // Delete old session
  await Session.deleteOne({ _id: session._id });

  // Issue new tokens
  const [newAccessToken, newRawRefresh] = await Promise.all([
    signAccessToken(userId, role.role),
    Promise.resolve(generateRefreshToken()),
  ]);

  await Session.create({
    userId: session.userId,
    tokenHash: hashToken(newRawRefresh),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: req.headers.get("user-agent") ?? "",
    ip,
  });

  const res = NextResponse.json({ ok: true });
  setAuthCookies(res.cookies, newAccessToken, newRawRefresh);
  return res;
}
