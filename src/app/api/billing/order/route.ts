import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { connectDB } from "@/app/lib/db";
import Payment from "@/app/models/Payment";
import { getSession } from "@/lib/auth";
import { getBillingLimiter } from "@/lib/ratelimit";
import { PLANS } from "@/lib/plans";


export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limiter = getBillingLimiter();
  const { success } = await limiter.limit(session.sub);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { planId } = body;
  if (!planId || !PLANS[planId]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = PLANS[planId];

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      receipt: `receipt_${Date.now()}_${session.sub}`,
    });

    await connectDB();
    await Payment.create({
      userId: session.sub,
      razorpayOrderId: order.id,
      planId: plan.id,
      credits: plan.credits,
      amountPaise: plan.amountPaise,
      status: "pending",
    });

    return NextResponse.json({
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: plan.amountPaise,
    });
  } catch (error: any) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
