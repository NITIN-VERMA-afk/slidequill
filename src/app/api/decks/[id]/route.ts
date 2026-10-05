/**
 * GET  /api/decks/[id]  — fetch one deck (own, no sourceText)
 * PATCH /api/decks/[id]  — update title and/or outline
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";

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
});

async function resolveOwned(id: string, userId: string) {
  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId }).select(
    "-sourceText"
  );
  return deck;
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
  const deck = await resolveOwned(id, session.sub);
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

  const { title, outline, theme } = parsed.data;
  if (title !== undefined) deck.title = title;
  if (outline !== undefined) deck.outline = outline;
  if (theme !== undefined) deck.theme = theme;
  await deck.save();

  return NextResponse.json({ deck });
}
