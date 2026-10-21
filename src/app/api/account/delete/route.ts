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
import { checkOrigin } from "@/lib/csrf";
import { getLoginLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";

export async function executeAccountDelete({
  userId,
  password = "",
  emailConfirmation = "",
}: {
  userId: string;
  password?: string;
  emailConfirmation?: string;
}): Promise<{ status: number; data: any }> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return { status: 404, data: { error: "User not found" } };

  if (user.authProvider === "google" || !user.passwordHash) {
    const confirmation = (emailConfirmation || password).trim().toLowerCase();
    if (!confirmation || confirmation !== user.email.toLowerCase()) {
      return {
        status: 400,
        data: { error: "Please enter your email address to confirm account deletion." },
      };
    }
  } else {
    if (!password) {
      return { status: 400, data: { error: "Password required" } };
    }

    if (!user.passwordHash) {
      return { status: 400, data: { error: "Password verification unavailable." } };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { status: 403, data: { error: "Incorrect password" } };
    }
  }

  // Delete Decks, Sessions, AuthTokens
  await Deck.deleteMany({ userId: user._id });
  await Session.deleteMany({ userId: user._id });
  await AuthToken.deleteMany({ userId: user._id });

  // Anonymize Payments
  await Payment.updateMany({ userId: user._id }, { $unset: { userId: 1, email: 1, name: 1, phone: 1 } });

  await User.deleteOne({ _id: user._id });

  return { status: 200, data: { success: true } };
}

export async function POST(req: NextRequest) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limiterKey = `${session.sub}:${ip}`;
  const rateLimit = await getLoginLimiter().limit(limiterKey);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const emailConfirmation = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const result = await executeAccountDelete({
    userId: session.sub,
    password,
    emailConfirmation,
  });

  if (result.status === 200) {
    const jar = await cookies();
    jar.delete("sq_at");
    jar.delete("sq_rt");
  }

  return NextResponse.json(result.data, { status: result.status });
}
