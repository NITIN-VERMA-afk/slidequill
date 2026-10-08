import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IPayment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  planId: string;
  credits: number;
  amountPaise: number;
  status: "pending" | "paid" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, sparse: true, unique: true },
    planId: { type: String, required: true },
    credits: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  },
  { timestamps: true }
);

const Payment = models.Payment ?? model<IPayment>("Payment", PaymentSchema);
export default Payment;
