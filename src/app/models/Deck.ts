import { Schema, model, models, type Document, type Types } from "mongoose";

export interface OutlineSection {
  id: string;
  title: string;
  points: string[];
  pageRange?: { start: number; end: number };
}

export type DeckStatus =
  | "draft"
  | "outlining"
  | "outlined"
  | "generating"
  | "ready"
  | "failed";

export interface IChunkNote {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  notes: string;
  keyPoints: string[];
  dataPoints: string[];
  promptTokens?: number;
  completionTokens?: number;
}

export interface IOutlineProgress {
  stage?: "chunking" | "mapping" | "reducing" | "done" | "failed";
  chunksDone: number;
  chunksTotal: number;
  currentPageRange?: string;
}

export interface ISlide {
  id: string;
  layout: string;
  title: string;
  content: any;
  notes: string;
  sourcePage?: number | string;
  sourceSection?: string;
  regenerations?: number;
  meta?: { fallback?: boolean };
}

export interface IDeckTokenUsage {
  outlinePromptTokens?: number;
  outlineCompletionTokens?: number;
  generatePromptTokens?: number;
  generateCompletionTokens?: number;
  totalTokens?: number;
}

export interface IChunkLease {
  chunkIndex: number;
  leasedAt: Date;
}

export interface IDeck extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  sourceText: string;
  sourceExpiresAt?: Date;
  sourceName: string;
  sourceMime?: string;
  sourcePageCount?: number;
  status: DeckStatus;
  theme: string;
  outline: OutlineSection[];
  slides: ISlide[];
  chunkNotes?: IChunkNote[];
  outlineProgress?: IOutlineProgress;
  tokenUsage?: IDeckTokenUsage;
  chunkLease?: IChunkLease | null;
  error: string;
  includeImages?: boolean;
  targetSlideCount?: number;
  coverImage?: string;
  creditCharged: boolean;
  creditRefunded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OutlineSectionSchema = new Schema<OutlineSection>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    points: [{ type: String }],
    pageRange: {
      start: { type: Number },
      end: { type: Number },
    },
  },
  { _id: false }
);

const ChunkNoteSchema = new Schema<IChunkNote>(
  {
    chunkIndex: { type: Number, required: true },
    startPage: { type: Number, required: true },
    endPage: { type: Number, required: true },
    notes: { type: String, default: "" },
    keyPoints: [{ type: String }],
    dataPoints: [{ type: String }],
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
  },
  { _id: false }
);

const OutlineProgressSchema = new Schema<IOutlineProgress>(
  {
    stage: { type: String, default: "mapping" },
    chunksDone: { type: Number, default: 0 },
    chunksTotal: { type: Number, default: 0 },
    currentPageRange: { type: String, default: "" },
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
    sourcePage: { type: Schema.Types.Mixed },
    sourceSection: { type: String },
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
    sourceExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: true,
    },
    sourceName: { type: String, default: "" },
    sourceMime: { type: String },
    sourcePageCount: { type: Number },
    status: {
      type: String,
      enum: ["draft", "outlining", "outlined", "generating", "ready", "failed"],
      default: "draft",
    },
    theme: { type: String, default: "modern" },
    outline: { type: [OutlineSectionSchema], default: [] },
    slides: { type: [SlideSchemaMongoose], default: [] },
    chunkNotes: { type: [ChunkNoteSchema], default: [], select: false },
    outlineProgress: { type: OutlineProgressSchema },
    chunkLease: {
      chunkIndex: { type: Number },
      leasedAt: { type: Date },
    },
    tokenUsage: {
      outlinePromptTokens: { type: Number, default: 0 },
      outlineCompletionTokens: { type: Number, default: 0 },
      generatePromptTokens: { type: Number, default: 0 },
      generateCompletionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    includeImages: { type: Boolean, default: true },
    targetSlideCount: { type: Number, default: 10 },
    coverImage: { type: String },
    error: { type: String, default: "" },
    creditCharged: { type: Boolean, default: false },
    creditRefunded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Deck = models.Deck ?? model<IDeck>("Deck", DeckSchema);
export default Deck;