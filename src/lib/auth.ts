/**
 * src/lib/auth.ts
 * Core auth utilities: JWT signing/verification, session lookup,
 * requireUser(), requireRole().
 *
 * Fail-fast on startup if JWT_SECRET is missing or too short.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDB } from "@/app/lib/db";
import User, { type IUser } from "@/app/models/User";
import Session from "@/app/models/Session";
import { hashToken } from "./cookies";

// ─── Env validation (fail fast) ──────────────────────────────────────────────

function getSecret() {
  const SECRET_RAW = process.env.JWT_SECRET;
  if (!SECRET_RAW || SECRET_RAW.length < 32) {
    throw new Error("[auth] JWT_SECRET env var must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(SECRET_RAW);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  sub: string; // userId
  role: "user" | "admin";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  credits: number;
  emailVerified: boolean;
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

/** Sign a new access token (15 min TTL). */
export async function signAccessToken(
  userId: string,
  role: "user" | "admin"
): Promise<string> {
  return new SignJWT({ role } satisfies Omit<AccessTokenPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

/** Verify an access token. Returns the payload or null on any error. */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

// ─── Session resolution (for server components / route handlers) ──────────────

/**
 * Read the sq_at cookie and return the decoded payload.
 * Does NOT hit the database — JWT-only fast path.
 * Returns null if the cookie is absent or invalid.
 */
export async function getSession(): Promise<AccessTokenPayload | null> {
  const jar = await cookies();
  const token = jar.get("sq_at")?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Like getSession() but also returns the full User document from the DB.
 * Use this when you need credits, emailVerified, etc.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const payload = await getSession();
  if (!payload?.sub) return null;

  await connectDB();
  const user = (await User.findById(payload.sub).lean()) as IUser | null;
  if (!user) return null;

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    credits: user.credits,
    emailVerified: user.emailVerified,
  };
}

// ─── Authorization guards ─────────────────────────────────────────────────────

/**
 * Use in Server Components / Route Handlers.
 * Throws a redirect to /login if the JWT is absent/expired.
 * Returns the decoded payload so callers can use sub + role.
 */
export async function requireUser(
  redirectTo = "/login"
): Promise<AccessTokenPayload> {
  const payload = await getSession();
  if (!payload) redirect(redirectTo);
  return payload;
}

/**
 * Require a specific role. Redirects to /login if unauthenticated,
 * returns 403-style redirect to "/" if role doesn't match.
 */
export async function requireRole(
  role: "admin"
): Promise<AccessTokenPayload> {
  const payload = await requireUser();
  if (payload.role !== role) redirect("/");
  return payload;
}

// ─── Refresh token DB helpers ─────────────────────────────────────────────────

/** Look up a refresh session by the raw token value. */
export async function findSession(rawToken: string) {
  await connectDB();
  const hash = hashToken(rawToken);
  return Session.findOne({ tokenHash: hash, expiresAt: { $gt: new Date() } });
}

/** Revoke all sessions for a user (replay attack mitigation). */
export async function revokeAllSessions(userId: string) {
  await connectDB();
  await Session.deleteMany({ userId });
}

/** Delete a single session by raw token. */
export async function deleteSession(rawToken: string) {
  await connectDB();
  const hash = hashToken(rawToken);
  await Session.deleteOne({ tokenHash: hash });
}
