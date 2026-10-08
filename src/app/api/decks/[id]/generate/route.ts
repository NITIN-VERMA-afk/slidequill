import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { runWithConcurrency } from "@/lib/concurrency";
import { SlideSchema, type SlideData } from "@/lib/slides-schema";
import type { OutlineSection } from "@/app/models/Deck";

const SLIDES_MODEL = process.env.SLIDES_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a presentation slide generator. 
The user will provide a section from a presentation outline. Your task is to generate ONE beautifully designed slide for this section.
Pick the best layout based on the content (e.g. use "stats" if there are numbers, "process" for a sequence, "two_column" for two groups, etc).
REWRITE the text to be punchy and concise. Max 12 words per bullet. Max 6 bullets total. 
Titles should state the conclusion (e.g., "Sales Grew 40%" instead of "Sales Data"). 
Include short speaker notes.

Output strictly in JSON matching the exact schema.
Here is the expected JSON schema:
{
  "title": "string (conclusion, not topic)",
  "notes": "string (1-2 sentences speaker notes)",
  "layout": "title" | "bullets" | "two_column" | "stats" | "process" | "comparison" | "quote" | "closing",
  "content": {
    // fields based on layout type:
    // title: { "subtitle": "string (optional)" }
    // bullets: { "bullets": ["string"] }
    // two_column: { "left": { "heading": "string (optional)", "bullets": ["string"] }, "right": { "heading": "string (optional)", "bullets": ["string"] } }
    // stats: { "stats": [ { "value": "string", "label": "string" } ] }
    // process: { "steps": [ { "label": "string", "desc": "string" } ] }
    // comparison: { "columns": [ { "heading": "string", "bullets": ["string"] } ] }
    // quote: { "quote": "string", "attribution": "string (optional)" }
    // closing: { "headline": "string", "cta": "string (optional)" }
  }
}`;

async function generateSlide(
  deckTitle: string,
  section: OutlineSection,
  isFirst: boolean,
  isLast: boolean
): Promise<SlideData | null> {
  let context = `Deck Title: ${deckTitle}\n\nSection Title: ${section.title}\nSection Points:\n${section.points
    .map((p) => `- ${p}`)
    .join("\n")}`;

  if (isFirst) context += `\n\n(This is the FIRST section. Please use the "title" layout.)`;
  else if (isLast) context += `\n\n(This is the LAST section. Please use the "closing" layout.)`;

  try {
    const completion = await openai.chat.completions.create({
      model: SLIDES_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = SlideSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error("Slide schema validation failed:", parsed.error.issues);
      return null;
    }
    return { ...parsed.data, id: randomUUID() };
  } catch (err) {
    console.error("Slide gen failed:", err);
    return null;
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();

  const deck = await Deck.findOne({ _id: id, userId: session.sub });
  if (!deck) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Block only if already has slides
  if (deck.slides && deck.slides.length > 0) {
    return NextResponse.json({ error: "Slides already generated." }, { status: 400 });
  }

  if (!deck.outline || deck.outline.length === 0) {
    return NextResponse.json({ error: "No outline to generate from." }, { status: 400 });
  }

  const userCheck = await User.findById(session.sub).select("emailVerified hasPurchased").lean();
  if (userCheck && !userCheck.emailVerified && !userCheck.hasPurchased) {
    return NextResponse.json({ error: "Please verify your email before generating decks." }, { status: 403 });
  }

  // Deduct credit atomically (only if not already in generating/ready stuck state)
  if (deck.status !== "generating" && deck.status !== "ready") {
    const user = await User.findOneAndUpdate(
      { _id: session.sub, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { returnDocument: "after" }
    );
    if (!user) {
      return NextResponse.json({ error: "Insufficient credits." }, { status: 402 });
    }
  }

  deck.status = "generating";
  deck.slides = [];
  await deck.save();

  try {
    const results = await runWithConcurrency(
      deck.outline as OutlineSection[],
      4,
      async (section, index) => {
        const isFirst = index === 0;
        const isLast = index === (deck.outline as OutlineSection[]).length - 1;
        return generateSlide(deck.title, section, isFirst, isLast);
      }
    );

    const validSlides = results.filter(Boolean) as SlideData[];
    console.log(`Generated ${validSlides.length}/${deck.outline.length} slides`);

    await Deck.updateOne(
      { _id: deck._id },
      { $set: { slides: validSlides, status: "ready" } }
    );

    return NextResponse.json({ message: "Done", slideCount: validSlides.length });
  } catch (err) {
    console.error("Generation error:", err);
    await Deck.updateOne({ _id: deck._id }, { $set: { status: "failed", error: "Slide generation failed." } });
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
