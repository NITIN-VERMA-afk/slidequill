/**
 * POST /api/decks/[id]/undo
 * Restores the latest DeckVersion snapshot.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import DeckVersion from "@/app/models/DeckVersion";
import { getSession } from "@/lib/auth";
import { getDeckLimiter } from "@/lib/ratelimit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { success } = await getDeckLimiter().limit(session.sub);
  if (!success) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const { id } = await params;
  await connectDB();

  const deck = await Deck.findOne({ _id: id, userId: session.sub });
  if (!deck) return NextResponse.json({ error: "Deck not found." }, { status: 404 });

  // Get latest snapshot
  const latestVersion = await DeckVersion.findOne({ deckId: id }).sort({ createdAt: -1 });
  if (!latestVersion) {
    return NextResponse.json({ error: "No undo history available." }, { status: 400 });
  }

  // Restore
  deck.slides = latestVersion.slides;
  deck.theme = latestVersion.theme;
  deck.markModified("slides");
  await deck.save();

  // Delete the snapshot so we can't undo it again (could implement Redo later)
  await DeckVersion.deleteOne({ _id: latestVersion._id });

  return NextResponse.json({
    message: "Undo successful.",
    slides: deck.slides,
    theme: deck.theme,
  });
}
