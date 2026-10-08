import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import AuthToken from "@/app/models/AuthToken";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Clean expired deck source text
  const result = await Deck.updateMany(
    { sourceExpiresAt: { $lt: new Date() }, sourceText: { $exists: true } },
    { $unset: { sourceText: "", sourceName: "" } }
  );

  // Expired AuthTokens are cleaned by TTL index, but we can proactively delete used ones
  await AuthToken.deleteMany({ usedAt: { $exists: true } });

  return NextResponse.json({ success: true, decksCleaned: result.modifiedCount });
}
