import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
  }

  await connectDB();
  
  // Add 100 credits to the currently logged in user
  await User.updateOne({ _id: session.sub }, { $inc: { credits: 100 } });

  return NextResponse.json({ message: "Successfully added 100 credits to your account!" });
}
