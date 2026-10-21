/**
 * POST /api/decks/[id]/slides/[slideId]/regenerate
 * Regenerates a single slide with an optional instruction. Costs 0 credits.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck, { type ISlide } from "@/app/models/Deck";
import User from "@/app/models/User";
import DeckVersion from "@/app/models/DeckVersion";
import { getSession } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { SlideSchema, formatSourcePage, validateAndSanitizeSourcePage, groundAndSanitizeSlide } from "@/lib/slides-schema";
import { searchStockImage } from "@/lib/image-search";
import { getDeckLimiter } from "@/lib/ratelimit"; // Reusing the same limiter
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId, isValidSlideId } from "@/lib/validation";

export const maxDuration = 60;
const SLIDES_MODEL = process.env.SLIDES_MODEL ?? "gpt-4o-mini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; slideId: string }> }
) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

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
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  if (!isValidSlideId(slideId)) {
    return NextResponse.json({ error: "Invalid slide ID." }, { status: 400 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const instruction = (body.instruction as string) || "";

  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId: session.sub }).select("+sourceText");
  if (!deck) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const slideIndex = deck.slides.findIndex((s: ISlide) => s.id === slideId);
  if (slideIndex === -1) {
    return NextResponse.json({ error: "Slide not found." }, { status: 404 });
  }

  const existingSlide = deck.slides[slideIndex] as ISlide;

  // Check user tier: free-tier capped at 3 regenerations per slide, paid capped at 10
  const user = await User.findById(session.sub).select("hasPurchased").lean();
  const maxRegens = user?.hasPurchased ? 10 : 3;

  if ((existingSlide.regenerations ?? 0) >= maxRegens) {
    return NextResponse.json(
      {
        error: user?.hasPurchased
          ? "Regeneration limit reached for this slide (10/10)."
          : "Free tier regeneration limit reached for this slide (3/3). Upgrade to Pro for more.",
      },
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

  try {
    const completion = await openai.chat.completions.create({
      model: SLIDES_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [{ role: "system", content: SYSTEM_PROMPT }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(raw);

    // Match outline section by title or slide index to get deterministic source metadata and talking points
    const matchedSection =
      deck.outline?.find((sec: any) => sec.title === existingSlide.sourceSection) ||
      deck.outline?.[slideIndex];

    const sanitized = groundAndSanitizeSlide(json, deck.sourceText, matchedSection?.points);
    const parsed = SlideSchema.safeParse(sanitized);
    if (!parsed.success) throw new Error("Parsed schema invalid");

    const sourceSection =
      existingSlide.sourceSection ||
      matchedSection?.title ||
      undefined;

    const sourcePage =
      formatSourcePage(matchedSection?.pageRange, deck.sourcePageCount) ||
      formatSourcePage(existingSlide.sourcePage, deck.sourcePageCount) ||
      undefined;

    const newSlide = {
      ...parsed.data,
      id: slideId, // Keep same ID
      sourceSection,
      sourcePage,
      regenerations: (existingSlide.regenerations ?? 0) + 1,
    };

    // Snapshot before applying
    await DeckVersion.create({
      deckId: id,
      slides: deck.slides,
      theme: deck.theme,
      reason: `Regenerate slide: ${instruction.slice(0, 50)}`,
    });

    // Keep only 20 snapshots (pinned initial version is never rotated out)
    const versions = await DeckVersion.find({ deckId: id, pinned: { $ne: true } }).sort({ createdAt: 1 }).select("_id");
    if (versions.length > 20) {
      const toDelete = versions.slice(0, versions.length - 20).map(v => v._id);
      await DeckVersion.deleteMany({ _id: { $in: toDelete } });
    }

    const contentAny = newSlide.content as any;
    if (contentAny?.imageQuery && (!contentAny.imageUrl || !contentAny.imageUrl.startsWith("http"))) {
      try {
        const stock = await searchStockImage(contentAny.imageQuery);
        if (stock?.url) {
          contentAny.imageUrl = stock.url;
          contentAny.photographer = stock.photographer;
          contentAny.photographerUrl = stock.photographerUrl;
          console.log(`[SlideImage] Regenerated slide (${newSlide.layout}): resolved image via '${stock.source}' (query: "${contentAny.imageQuery}")`);
        }
      } catch (err) {
        console.warn("[SlideImage] Single slide regenerate image fetch failed:", err);
      }
    }

    const isSourceDeleted = !deck.sourceText || !deck.sourceText.trim();
    const isStatsOrChart =
      existingSlide.layout === "stats" ||
      existingSlide.layout === "chart" ||
      newSlide.layout === "stats" ||
      newSlide.layout === "chart";

    const note =
      isSourceDeleted && isStatsOrChart
        ? "Source text was deleted, so this slide can't use verified numbers"
        : undefined;

    const groundedSlide = groundAndSanitizeSlide(newSlide, deck.sourceText);
    deck.slides[slideIndex] = groundedSlide;
    deck.markModified(`slides.${slideIndex}`);
    await deck.save();

    return NextResponse.json({
      slide: groundedSlide,
      ...(note ? { note } : {}),
    });
  } catch (err) {
    console.error("Regeneration failed:", err);
    return NextResponse.json(
      { error: "Failed to regenerate slide." },
      { status: 500 }
    );
  }
}
