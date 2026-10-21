import { Schema, model, models, type Document, type Types } from "mongoose";

export type AnalyticsEventType =
  | "signup"
  | "deck_created"
  | "outline_generated"
  | "deck_generated"
  | "slide_regenerated"
  | "pptx_exported"
  | "pdf_exported"
  | "export"
  | "credit_purchase_started"
  | "credit_purchased"
  | "generation_failed";

export interface IAnalyticsEvent extends Document {
  _id: Types.ObjectId;
  event: AnalyticsEventType;
  userId?: Types.ObjectId;
  deckId?: Types.ObjectId;
  meta?: Record<string, any>;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    event: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    deckId: { type: Schema.Types.ObjectId, ref: "Deck", index: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index to automatically purge events after 90 days
AnalyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AnalyticsEvent =
  models.AnalyticsEvent ?? model<IAnalyticsEvent>("AnalyticsEvent", AnalyticsEventSchema);

export default AnalyticsEvent;
