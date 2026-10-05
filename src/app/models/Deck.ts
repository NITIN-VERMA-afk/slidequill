import { Schema, model, models, type Document, type Types } from "mongoose";

export interface OutlineSection {
  id: string;
  title: string;
  points: string[];
}

export type DeckStatus =
  | "draft"
  | "outlining"
  | "outlined"
  | "generating"
  | "ready"
  | "failed";

export interface ISlide {
  id: string;
  layout: string;
  title: string;
  content: any;
  notes: string;
  regenerations?: number;
}

export interface IDeck extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  sourceText: string;
  sourceName: string;
  status: DeckStatus;
  theme: string;
  outline: OutlineSection[];
  slides: ISlide[];
  error: string;
  createdAt: Date;
  updatedAt: Date;
}

const OutlineSectionSchema = new Schema<OutlineSection>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    points: [{ type: String }],
  },
  { _id: false }
);

const SlideSchemaMongoose = new Schema<ISlide>(
  {
    id: { type: String, required: true },
    layout: { type: String, required: true },
    title: { type: String, default: "" },
    content: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: "" },
    regenerations: { type: Number, default: 0 },
  },
  { _id: false }
);

const DeckSchema = new Schema<IDeck>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "Untitled deck" },
    sourceText: { type: String, select: false },
    sourceName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "outlining", "outlined", "generating", "ready", "failed"],
      default: "draft",
    },
    theme: { type: String, default: "modern" },
    outline: { type: [OutlineSectionSchema], default: [] },
    slides: { type: [SlideSchemaMongoose], default: [] },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

const Deck = models.Deck ?? model<IDeck>("Deck", DeckSchema);
export default Deck;