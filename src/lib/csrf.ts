/**
 * src/lib/csrf.ts
 * Simple origin-based CSRF check for mutating API routes.
 * Allows requests from APP_URL (default: http://localhost:3000).
 */
import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/** Returns a 403 NextResponse if the origin is not allowed, or null if OK. */
export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Same-origin requests from Next.js server actions / fetch won't always
  // include an Origin. Allow those.
  if (!origin && !referer) return null;

  const allowed = new URL(APP_URL).origin;
  const requestOrigin = origin
    ? new URL(origin).origin
    : referer
    ? new URL(referer).origin
    : null;

  // Allow if it matches APP_URL or the actual request host (for Vercel previews)
  if (requestOrigin !== allowed && requestOrigin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return null;
}
