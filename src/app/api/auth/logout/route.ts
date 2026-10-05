/**
 * POST /api/auth/logout
 * Deletes the server-side session and clears cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Session from "@/app/models/Session";
import { hashToken, clearAuthCookies } from "@/lib/cookies";
import { checkOrigin } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const cookieHeader = req.cookies.get("sq_rt")?.value;
  if (cookieHeader) {
    await connectDB();
    await Session.deleteOne({ tokenHash: hashToken(cookieHeader) });
  }

  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res.cookies);
  return res;
}
