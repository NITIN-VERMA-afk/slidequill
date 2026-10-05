import { Schema, model, models, type Document, type Types } from "mongoose";

export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string; // sha256 of the raw refresh token
  expiresAt: Date;
  userAgent: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

const Session = models.Session ?? model<ISession>("Session", SessionSchema);
export default Session;
