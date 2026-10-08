import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Payment from "@/app/models/Payment";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await connectDB();
  
  const user = await User.findById(session.sub).select("credits hasPurchased").lean();
  const payments = await Payment.find({ userId: session.sub })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json({ 
    credits: user?.credits ?? 0, 
    hasPurchased: user?.hasPurchased ?? false,
    payments 
  });
}
