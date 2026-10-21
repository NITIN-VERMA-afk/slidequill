/**
 * src/lib/auth.ts
 * Core auth utilities: JWT signing/verification, session lookup,
 * requireUser(), requireRole().
 *
 * Fail-fast on startup if JWT_SECRET is missing or too short.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies, headers } from "next/headers";
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
    const { payload } = await jwtVerify<AccessTokenPayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}

// ─── Session resolution (for server components / route handlers) ──────────────

// Test hook to mock next/headers in unit tests without requestAsyncStorage
let mockCookiesFn: (() => Promise<{ get: (name: string) => { value?: string } | undefined }>) | null = null;
let mockHeadersFn: (() => Promise<{ get: (name: string) => string | null }>) | null = null;

export function __setMockHeaders(mock: {
  cookies?: (() => Promise<{ get: (name: string) => { value?: string } | undefined }>) | null;
  headers?: (() => Promise<{ get: (name: string) => string | null }>) | null;
} | null) {
  mockCookiesFn = mock?.cookies ?? null;
  mockHeadersFn = mock?.headers ?? null;
}

/**
 * Read the sq_at cookie or Authorization Bearer header and return the decoded payload.
 * Fallback to sq_rt refresh token lookup if access token is expired/missing.
 * Returns null if unauthenticated.
 */
export async function getSession(): Promise<AccessTokenPayload | null> {
  let jar: { get: (name: string) => { value?: string } | undefined } | null = null;
  try {
    jar = mockCookiesFn ? await mockCookiesFn() : await cookies();
  } catch {
    // cookies() not available in test or non-request context
  }

  const token = jar?.get("sq_at")?.value;
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload) return payload;
  }

  // Check Authorization: Bearer <token> header for API requests
  try {
    const head = mockHeadersFn ? await mockHeadersFn() : await headers();
    const authHeader = head.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearer = authHeader.slice(7).trim();
      const payload = await verifyAccessToken(bearer);
      if (payload) return payload;
    }
  } catch {
    // headers() may not be available in non-request contexts
  }

  // Fallback: check refresh token if sq_at is missing or expired
  if (jar) {
    const rawRefresh = jar.get("sq_rt")?.value;
    if (!rawRefresh) return null;
    const session = await findSession(rawRefresh);
    if (!session?.userId) return null;

    await connectDB();
    const user = (await User.findById(session.userId).select("role").lean()) as IUser | null;
    if (!user) return null;

    return {
      sub: session.userId.toString(),
      role: user.role,
    };
  }

  return null;
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
