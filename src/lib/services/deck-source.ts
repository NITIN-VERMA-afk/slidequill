import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { isValidObjectId } from "@/lib/validation";

/**
 * Permanently and immediately removes the raw source document text and source name
 * from the database for the owned deck. Outline and slides remain intact.
 */
export async function deleteDeckSourceText(
  deckId: string,
  userId: string
): Promise<{ success: boolean; status: number; error?: string }> {
  if (!isValidObjectId(deckId)) {
    return { success: false, status: 400, error: "Invalid deck ID." };
  }
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

