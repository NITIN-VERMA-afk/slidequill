import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";
import { getShareMutationLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { generateUniqueShareSlug } from "@/lib/share";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/decks/[id]/share
 * Enables/generates a public share link for a deck.
 * Generates a brand new slug every time so old revoked slugs remain permanently dead.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }

  // Rate limit: 10 share mutations per minute per user
  const ip = getClientIp(req);
  const limiter = getShareMutationLimiter();
  const rlKey = `${session.sub}:${ip}`;
  const { success } = await limiter.limit(rlKey).catch(() => ({ success: true }));
  if (!success) {
    return NextResponse.json(
      { error: "Too many share requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId: session.sub });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  if (deck.status !== "ready") {
    return NextResponse.json(
      { error: "Only decks in 'ready' status can be shared." },
      { status: 400 }
    );
  }

  // Generate a brand new slug (old slug stays dead)
  const newSlug = await generateUniqueShareSlug();
  deck.share = {
    enabled: true,
    slug: newSlug,
    createdAt: new Date(),
    revokedAt: undefined,
  };
  await deck.save();

  const baseUrl = process.env.NEXTAUTH_URL || "";
  const publicUrl = `/p/${newSlug}`;

  return NextResponse.json({
    enabled: true,
    slug: newSlug,
    url: publicUrl,
    fullUrl: baseUrl ? `${baseUrl}${publicUrl}` : publicUrl,
  });
}

/**
 * DELETE /api/decks/[id]/share
 * Revokes the active share link immediately.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const limiter = getShareMutationLimiter();
  const rlKey = `${session.sub}:${ip}`;
  const { success } = await limiter.limit(rlKey).catch(() => ({ success: true }));
  if (!success) {
    return NextResponse.json(
      { error: "Too many share requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId: session.sub });
  if (!deck) {
    return NextResponse.json({ error: "Deck not found." }, { status: 404 });
  }

  if (deck.share) {
    deck.share.enabled = false;
    deck.share.revokedAt = new Date();
    await deck.save();
  }

  return NextResponse.json({
    enabled: false,
    message: "Share link revoked successfully.",
  });
}
