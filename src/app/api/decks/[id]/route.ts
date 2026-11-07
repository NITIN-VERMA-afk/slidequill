/**
 * GET  /api/decks/[id]  — fetch one deck (own, no sourceText)
 * PATCH /api/decks/[id]  — update title, outline, single slide or full slides with concurrency control
 * DELETE /api/decks/[id] — delete deck
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { getDeckMutationLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";
import { getDeckById, executeDeckPatch } from "@/lib/services/deck-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
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
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { success } = await getDeckMutationLimiter().limit(session.sub);
    if (!success) {
      return NextResponse.json(
        { error: "Too many deck update requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  } catch {
    // If ratelimiter is unavailable, do not block
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const result = await executeDeckPatch({
    deckId: id,
    userId: session.sub,
    patchData: body,
  });

  return NextResponse.json(result.data, { status: result.status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = checkOrigin(req);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { success } = await getDeckMutationLimiter().limit(session.sub);
    if (!success) {
      return NextResponse.json(
        { error: "Too many deck deletion requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  } catch {
    // If ratelimiter is unavailable, do not block
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }
  await connectDB();
  const result = await Deck.deleteOne({ _id: id, userId: session.sub });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
