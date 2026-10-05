/**
 * src/lib/cookies.ts
 * Cookie helpers: set/clear auth cookies, hash tokens.
 */
import { createHash, randomBytes } from "crypto";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

const IS_PROD = process.env.NODE_ENV === "production";

const COOKIE_BASE = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

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
