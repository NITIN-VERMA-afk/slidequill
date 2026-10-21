import { Schema, model, models, type Document } from "mongoose";

export interface IConsumedPrintToken extends Document {
  jti: string;
  consumedAt: Date;
}

const ConsumedPrintTokenSchema = new Schema<IConsumedPrintToken>({
  jti: { type: String, required: true, unique: true },
  consumedAt: { type: Date, default: Date.now, expires: 600 }, // TTL index: prunes after 10 minutes (600s)
});

export default models.ConsumedPrintToken ??
  model<IConsumedPrintToken>("ConsumedPrintToken", ConsumedPrintTokenSchema);
