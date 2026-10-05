import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: "user" | "admin";
  credits: number;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    credits: { type: Number, default: 3 },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = models.User ?? model<IUser>("User", UserSchema);
export default User;