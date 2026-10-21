/**
 * src/proxy.ts  (Next.js 16 replacement for middleware.ts)
 *
 * Only performs JWT cookie verification — NO database calls.
 * Every API route still calls requireUser() independently.
 *
 * Protected:  /dashboard/**, /decks/**  → redirect to /login?next=... if no valid JWT
 * Auth pages: /login, /signup           → redirect to /dashboard if already logged in
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("sq_at")?.value;
  if (token) {
    try {
      await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
      return true;
    } catch {
      // access token expired, check refresh token
    }
  }
  const refreshToken = req.cookies.get("sq_rt")?.value;
  if (refreshToken) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public presentation pages, public APIs, and token-authenticated render pages without cookie session
  if (pathname.startsWith("/p/") || pathname.startsWith("/api/public/") || pathname.startsWith("/render/")) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    response.headers.set("Surrogate-Control", "no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const authed = await isAuthenticated(request);

  // Protected routes → require auth
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/decks")) {
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Auth pages → redirect away if already logged in
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/login/" ||
    pathname === "/signup" ||
    pathname === "/signup/"
  ) {
    if (authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static
     * - _next/image
     * - favicon.ico, public assets
     * - API routes (those guard themselves)
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
