/**
 * GET  /api/decks/[id]  — fetch one deck (own, no sourceText)
 * PATCH /api/decks/[id]  — update title and/or outline
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { validateImageUrlServerSide } from "@/lib/safe-image-fetcher";
import { validateAndSanitizeSourcePage } from "@/lib/slides-schema";
import { executeAtomicRefund } from "./generate/route";

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  theme: z.string().max(50).optional(),
  outline: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(200),
        points: z.array(z.string().max(500)).max(10),
      })
    )
    .max(20)
    .optional(),
  slides: z.array(z.any()).max(50).optional(),
});

async function resolveOwned(id: string, userId: string) {
  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId }).select(
    "-sourceText"
  );
  return deck;
}

export async function getDeckById(id: string, userId: string) {
  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId }).select("+sourceText");
  if (!deck) return null;

  // Stuck deck recovery: if deck is in "outlining" or "generating" with no progress for >30 minutes,
  // run the same atomic refund-and-fail logic used by the cron (exactly-once)
  const STUCK_TIMEOUT_MS = 30 * 60 * 1000;
  const isStuckStatus = deck.status === "outlining" || deck.status === "generating";
  const isStuckDuration =
    deck.updatedAt && Date.now() - new Date(deck.updatedAt).getTime() > STUCK_TIMEOUT_MS;

  if (isStuckStatus && isStuckDuration) {
    await executeAtomicRefund(deck._id, userId);
    const refreshed = await Deck.findOne({ _id: id, userId }).select("+sourceText");
    if (refreshed) {
      const hasSourceText = Boolean(refreshed.sourceText && refreshed.sourceText.trim().length > 0);
      const deckObj = refreshed.toObject();
      delete deckObj.sourceText;
      return { ...deckObj, hasSourceText };
    }
  }

  const hasSourceText = Boolean(deck.sourceText && deck.sourceText.trim().length > 0);
  const deckObj = deck.toObject();
  delete deckObj.sourceText;

  return { ...deckObj, hasSourceText };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const deck = await getDeckById(id, session.sub);
  if (!deck) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ deck });
}


export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const deck = await resolveOwned(id, session.sub);
  if (!deck) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, outline, theme, slides } = parsed.data;

  if (slides !== undefined) {
    for (const slide of slides) {
      if (slide.sourcePage !== undefined) {
        slide.sourcePage = validateAndSanitizeSourcePage(slide.sourcePage, deck.sourcePageCount);
      }
      const imgUrl = slide?.content?.imageUrl;
      if (imgUrl && typeof imgUrl === "string" && imgUrl.trim().length > 0) {
        const validation = await validateImageUrlServerSide(imgUrl);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error || "Disallowed or invalid image URL." },
            { status: 400 }
          );
        }
      }
    }
  }

  if (title !== undefined) deck.title = title;
  if (outline !== undefined) deck.outline = outline;
  if (theme !== undefined) deck.theme = theme;
  if (slides !== undefined) deck.slides = slides;
  await deck.save();

  return NextResponse.json({ deck });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const result = await Deck.deleteOne({ _id: id, userId: session.sub });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
