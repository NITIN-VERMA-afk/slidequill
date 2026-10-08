import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IAuthToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: "verify" | "reset";
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

const AuthTokenSchema = new Schema<IAuthToken>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["verify", "reset"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  usedAt: { type: Date },
});

export default models.AuthToken ?? model<IAuthToken>("AuthToken", AuthTokenSchema);
