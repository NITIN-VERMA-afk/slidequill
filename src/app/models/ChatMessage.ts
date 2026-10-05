import { Schema, model, models, type Document, type Types } from "mongoose";

export interface IChatMessage extends Document {
  deckId: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  opsApplied: number;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    deckId: { type: Schema.Types.ObjectId, ref: "Deck", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    opsApplied: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ChatMessage = models.ChatMessage ?? model<IChatMessage>("ChatMessage", ChatMessageSchema);
export default ChatMessage;
