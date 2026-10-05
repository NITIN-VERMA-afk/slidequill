import { z } from "zod";
import { SlideSchema, SlideLayouts } from "@/lib/slides-schema";

const SlideId = z.string().describe("ID of the slide");

export const OpUpdateSlide = z.object({
  op: z.literal("update_slide"),
  slideId: SlideId,
  fields: z.object({
    title: z.string().optional(),
    content: z.record(z.string(), z.any()).describe("Partial or full content updates mapping to the current layout").optional(),
  }),
});

export const OpChangeLayout = z.object({
  op: z.literal("change_layout"),
  slideId: SlideId,
  layout: z.string().describe("The new layout name (e.g. stats, two_column)"),
  content: z.record(z.string(), z.any()).describe("The complete content object required by the new layout"),
});

export const OpAddSlide = z.object({
  op: z.literal("add_slide"),
  afterSlideId: z.string().describe("ID of the slide to insert after, or 'start'").optional(),
  slide: SlideSchema.describe("The complete new slide data (layout, title, content, notes)"),
});

export const OpDeleteSlide = z.object({
  op: z.literal("delete_slide"),
  slideId: SlideId,
});

export const OpMoveSlide = z.object({
  op: z.literal("move_slide"),
  slideId: SlideId,
  toIndex: z.number().describe("The new index for this slide"),
});

export const OpSetTheme = z.object({
  op: z.literal("set_theme"),
  theme: z.enum(["modern", "corporate", "creative", "dark", "playful", "elegant"]),
});

export const OpUpdateNotes = z.object({
  op: z.literal("update_notes"),
  slideId: SlideId,
  notes: z.string(),
});

export const OpSchema = z.discriminatedUnion("op", [
  OpUpdateSlide,
  OpChangeLayout,
  OpAddSlide,
  OpDeleteSlide,
  OpMoveSlide,
  OpSetTheme,
  OpUpdateNotes,
]);

export type Op = z.infer<typeof OpSchema>;

export const ChatResponseSchema = z.object({
  reply: z.string().describe("Friendly response explaining what you did, or a clarifying question."),
  ops: z.array(OpSchema).max(15).describe("List of operations to apply to the slides. Return empty if clarifying."),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
