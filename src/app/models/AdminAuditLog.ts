import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IAdminAuditLog extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  action: string;
  amount: number;
  timestamp: Date;
  note?: string;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, default: "grant_credits" },
    amount: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const AdminAuditLog =
  models.AdminAuditLog ?? model<IAdminAuditLog>("AdminAuditLog", AdminAuditLogSchema);

export default AdminAuditLog;
