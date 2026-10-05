/**
 * POST /api/decks/[id]/slides/[slideId]/regenerate
 * Regenerates a single slide with an optional instruction. Costs 0 credits.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck, { type ISlide } from "@/app/models/Deck";
import DeckVersion from "@/app/models/DeckVersion";
import { getSession } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { SlideSchema } from "@/lib/slides-schema";
import { getDeckLimiter } from "@/lib/ratelimit"; // Reusing the same limiter

const SLIDES_MODEL = process.env.SLIDES_MODEL ?? "gpt-4o-mini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Rate limit
  const { success } = await getDeckLimiter().limit(session.sub);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  const { id, slideId } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const instruction = (body.instruction as string) || "";

  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId: session.sub });
  if (!deck) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const slideIndex = deck.slides.findIndex((s: ISlide) => s.id === slideId);
  if (slideIndex === -1) {
    return NextResponse.json({ error: "Slide not found." }, { status: 404 });
  }

  const existingSlide = deck.slides[slideIndex] as ISlide;

  if ((existingSlide.regenerations ?? 0) >= 10) {
    return NextResponse.json(
      { error: "Regeneration limit reached for this slide." },
      { status: 403 }
    );
  }

  const SYSTEM_PROMPT = `You are a presentation slide editor.
The user wants to REGENERATE a slide. Here is the ORIGINAL slide content:
Title: ${existingSlide.title}
Layout: ${existingSlide.layout}
Content: ${JSON.stringify(existingSlide.content)}
Notes: ${existingSlide.notes}

${instruction ? `\nUSER INSTRUCTION FOR REGENERATION:\n"${instruction}"\n` : ""}

Generate a new version of this slide. Keep the same layout unless instructed otherwise.
Output strictly in JSON matching the exact schema.`;

  try {
    const completion = await openai.chat.completions.create({
      model: SLIDES_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(raw);
    const parsed = SlideSchema.safeParse(json);
    if (!parsed.success) throw new Error("Parsed schema invalid");

    const newSlide = {
      ...parsed.data,
      id: slideId, // Keep same ID
      regenerations: (existingSlide.regenerations ?? 0) + 1,
    };

    // Snapshot before applying
    await DeckVersion.create({
      deckId: id,
      slides: deck.slides,
      theme: deck.theme,
      reason: `Regenerate slide: ${instruction.slice(0, 50)}`,
    });

    // Keep only 20 snapshots
    const versions = await DeckVersion.find({ deckId: id }).sort({ createdAt: 1 }).select("_id");
    if (versions.length > 20) {
      const toDelete = versions.slice(0, versions.length - 20).map(v => v._id);
      await DeckVersion.deleteMany({ _id: { $in: toDelete } });
    }

    deck.slides[slideIndex] = newSlide;
    deck.markModified(`slides.${slideIndex}`);
    await deck.save();

    return NextResponse.json({ slide: newSlide });
  } catch (err) {
    console.error("Regeneration failed:", err);
    return NextResponse.json(
      { error: "Failed to regenerate slide." },
      { status: 500 }
    );
  }
}
