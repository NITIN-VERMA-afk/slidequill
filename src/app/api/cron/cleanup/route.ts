import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import AuthToken from "@/app/models/AuthToken";
import { executeAtomicRefund } from "@/app/api/decks/[id]/generate/route";

/**
 * Core cleanup logic:
 * 1. Unsets expired sourceText and sourceName on decks where sourceExpiresAt < now.
 * 2. Recovers decks stuck in "outlining" or "generating" for >= 30 minutes without progress:
 *    marks them as failed and refunds credits exactly once using executeAtomicRefund.
 * 3. Removes consumed AuthTokens.
 * Never deletes Deck documents.
 */
export async function executeCleanupJob(): Promise<{
  decksCleaned: number;
  tokensCleaned: number;
  stuckDecksRecovered: number;
}> {
  await connectDB();

  // 1. Clean expired deck source text and cached document map notes
  const deckResult = await Deck.updateMany(
    { sourceExpiresAt: { $lt: new Date() }, sourceText: { $exists: true } },
    { $unset: { sourceText: "", sourceName: "", chunkNotes: "", outlineProgress: "" } }
  );

  // 2. Recover decks stuck in outlining or generating with no progress for 30 minutes
  const STUCK_TIMEOUT_MS = 30 * 60 * 1000;
  const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
  const stuckDecks = await Deck.find({
    status: { $in: ["outlining", "generating"] },
    updatedAt: { $lt: stuckCutoff },
  }).select("_id userId");

  let stuckDecksRecovered = 0;
  for (const stuck of stuckDecks) {
    try {
      await executeAtomicRefund(stuck._id, stuck.userId);
      stuckDecksRecovered++;
    } catch (err) {
      console.error(`[Cron] Error recovering stuck deck ${stuck._id}:`, err);
    }
  }

  // 3. Expired AuthTokens are cleaned by TTL index, but we can proactively delete used ones
  const tokenResult = await AuthToken.deleteMany({ usedAt: { $exists: true } });

  return {
    decksCleaned: deckResult.modifiedCount,
    tokensCleaned: tokenResult.deletedCount,
    stuckDecksRecovered,
  };
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { decksCleaned, stuckDecksRecovered } = await executeCleanupJob();

  return NextResponse.json({ success: true, decksCleaned, stuckDecksRecovered });
}


