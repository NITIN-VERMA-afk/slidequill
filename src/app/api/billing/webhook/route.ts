import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/app/lib/db";
import Payment from "@/app/models/Payment";
import User from "@/app/models/User";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is unset");
      return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is unset" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature);
    const signatureBuf = Buffer.from(signature);

    if (
      expectedBuf.length !== signatureBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

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
          { returnDocument: "after" }
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

            // Track analytics event
            void trackEvent("credit_purchased", {
              userId: payment.userId.toString(),
              meta: {
                credits: payment.credits,
                amountPaise: payment.amountPaise,
                paymentId,
              },
            });
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
