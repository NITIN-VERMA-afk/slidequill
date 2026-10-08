import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/db";
import Payment from "@/app/models/Payment";
import User from "@/app/models/User";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not set");
      return NextResponse.json({ error: "Webhook config error" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const paymentData = event.payload.payment.entity;
      const orderId = paymentData.order_id;
      const paymentId = paymentData.id;

      await connectDB();

      // Find the pending payment
      const payment = await Payment.findOne({ razorpayOrderId: orderId, status: "pending" });
      if (payment) {
        // Atomic update to mark paid and set unique payment id
        const updatedPayment = await Payment.findOneAndUpdate(
          { _id: payment._id, status: "pending" },
          { $set: { status: "paid", razorpayPaymentId: paymentId } },
          { new: true }
        );

        if (updatedPayment) {
          if (!payment.userId) {
            console.log("Payment captured but user was deleted (userId unset)", paymentId);
          } else {
            // Grant credits and set hasPurchased
            const res = await User.updateOne(
              { _id: payment.userId },
              { 
                $inc: { credits: payment.credits },
                $set: { hasPurchased: true }
              }
            );
            if (res.matchedCount === 0) {
              console.log("Payment captured but user no longer exists", payment.userId);
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
