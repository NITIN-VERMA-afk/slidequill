import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";

/**
 * Permanently and immediately removes the raw source document text and source name
 * from the database for the owned deck. Outline and slides remain intact.
 */
export async function deleteDeckSourceText(
  deckId: string,
  userId: string
): Promise<{ success: boolean; status: number; error?: string }> {
  await connectDB();

  const deck = await Deck.findOne({ _id: deckId, userId });
  if (!deck) {
    return { success: false, status: 404, error: "Deck not found." };
  }

  // If the deck is actively outlining, reject immediate source deletion until outline is done
  if (deck.status === "outlining") {
    return {
      success: false,
      status: 400,
      error: "Cannot delete source text while outline generation is in progress.",
    };
  }

  await Deck.updateOne(
    { _id: deckId, userId },
    { $unset: { sourceText: "", sourceName: "", chunkNotes: "", outlineProgress: "" } }
  );


  return { success: true, status: 200 };
}

/**
 * DELETE /api/decks/[id]/source
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteDeckSourceText(id, session.sub);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: "Source text and document name permanently deleted.",
  });
}
