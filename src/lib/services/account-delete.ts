import bcrypt from "bcryptjs";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";
import Deck from "@/app/models/Deck";
import Session from "@/app/models/Session";
import Payment from "@/app/models/Payment";
import AuthToken from "@/app/models/AuthToken";

export async function executeAccountDelete({
  userId,
  password = "",
  emailConfirmation = "",
}: {
  userId: string;
  password?: string;
  emailConfirmation?: string;
}): Promise<{ status: number; data: any }> {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return { status: 404, data: { error: "User not found" } };

  if (user.authProvider === "google" || !user.passwordHash) {
    const confirmation = (emailConfirmation || password).trim().toLowerCase();
    if (!confirmation || confirmation !== user.email.toLowerCase()) {
      return {
        status: 400,
        data: { error: "Please enter your email address to confirm account deletion." },
      };
    }
  } else {
    if (!password) {
      return { status: 400, data: { error: "Password required" } };
    }

    if (!user.passwordHash) {
      return { status: 400, data: { error: "Password verification unavailable." } };
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { status: 403, data: { error: "Incorrect password" } };
    }
  }

  // Delete Decks, Sessions, AuthTokens
  await Deck.deleteMany({ userId: user._id });
  await Session.deleteMany({ userId: user._id });
  await AuthToken.deleteMany({ userId: user._id });

  // Anonymize Payments
  await Payment.updateMany({ userId: user._id }, { $unset: { userId: 1, email: 1, name: 1, phone: 1 } });

  await User.deleteOne({ _id: user._id });

  return { status: 200, data: { success: true } };
}

