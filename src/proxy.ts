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

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("sq_at")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
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
