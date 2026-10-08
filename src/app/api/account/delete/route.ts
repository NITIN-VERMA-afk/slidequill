import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import Deck from "@/app/models/Deck";
import Session from "@/app/models/Session";
import Payment from "@/app/models/Payment";
import AuthToken from "@/app/models/AuthToken";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findById(session.sub);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
  }

  // Delete Decks, Sessions, AuthTokens
  await Deck.deleteMany({ userId: user._id });
  await Session.deleteMany({ userId: user._id });
  await AuthToken.deleteMany({ userId: user._id });
  
  // Anonymize Payments
  await Payment.updateMany({ userId: user._id }, { $unset: { userId: 1, email: 1, name: 1, phone: 1 } });
  
  await User.deleteOne({ _id: user._id });

  // Clear auth cookies
  const jar = await cookies();
  jar.delete("sq_at");
  jar.delete("sq_rt");

  return NextResponse.json({ success: true });
}
