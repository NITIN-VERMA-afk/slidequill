import { Schema, model, models, type Document, type Types } from "mongoose";
import type { ISlide } from "./Deck";

export interface IDeckVersion extends Document {
  deckId: Types.ObjectId;
  slides: ISlide[];
  theme: string;
  reason: string;
  createdAt: Date;
}

const DeckVersionSchema = new Schema<IDeckVersion>(
  {
    deckId: { type: Schema.Types.ObjectId, ref: "Deck", required: true, index: true },
    slides: { type: [Schema.Types.Mixed], default: [] } as any,
    theme: { type: String, required: true },
    reason: { type: String, default: "Manual snapshot" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const DeckVersion = models.DeckVersion ?? model<IDeckVersion>("DeckVersion", DeckVersionSchema);
export default DeckVersion;
