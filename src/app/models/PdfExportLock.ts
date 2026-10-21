import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IPdfExportLock extends Document {
  userId: Types.ObjectId;
  lockOwner: string;
  expiresAt: Date;
}

const PdfExportLockSchema = new Schema<IPdfExportLock>({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  lockOwner: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export default models.PdfExportLock ??
  model<IPdfExportLock>("PdfExportLock", PdfExportLockSchema);
