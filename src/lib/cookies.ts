/**
 * src/lib/cookies.ts
 * Cookie helpers: set/clear auth cookies, hash tokens.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

const IS_PROD = process.env.NODE_ENV === "production";

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

export const OAUTH_STATE_COOKIE = "oauth_state";

/** Generate a cryptographically random 32-byte OAuth state parameter (hex). */
export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

/** Set short-lived (10 min), httpOnly, secure, sameSite=lax OAuth state cookie. */
export function setOAuthStateCookie(cookieJar: ResponseCookies, state: string) {
  cookieJar.set(OAUTH_STATE_COOKIE, state, {
    ...COOKIE_BASE,
    maxAge: 60 * 10, // 10 minutes
  });
}

/** Clear the OAuth state cookie. */
export function clearOAuthStateCookie(cookieJar: ResponseCookies) {
  cookieJar.set(OAUTH_STATE_COOKIE, "", {
    ...COOKIE_BASE,
    maxAge: 0,
  });
}

/** Timing-safe verification of returned state vs stored cookie state. */
export function verifyOAuthState(
  returnedState?: string | null,
  cookieState?: string | null
): boolean {
  if (!returnedState || !cookieState) return false;
  try {
    const bufA = Buffer.from(returnedState);
    const bufB = Buffer.from(cookieState);
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Generate a cryptographically random 32-byte refresh token (hex). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 hash of a raw token — stored in DB, never the raw value. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Write sq_at and sq_rt cookies onto a ResponseCookies instance. */
export function setAuthCookies(
  cookieJar: ResponseCookies,
  accessToken: string,
  refreshToken: string
) {
  cookieJar.set("sq_at", accessToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 15, // 15 minutes
  });
  cookieJar.set("sq_rt", refreshToken, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/** Clear both auth cookies. */
export function clearAuthCookies(cookieJar: ResponseCookies) {
  cookieJar.set("sq_at", "", { ...COOKIE_BASE, maxAge: 0 });
  cookieJar.set("sq_rt", "", { ...COOKIE_BASE, maxAge: 0 });
}

