/**
 * GET /api/auth/me
 * Returns the current user's profile from the DB.
 * Requires a valid access token cookie.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("sq_at")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(payload.sub)
    .select("email name role credits emailVerified")
    .lean();

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}
