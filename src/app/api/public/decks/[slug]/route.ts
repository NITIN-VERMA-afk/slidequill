import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getPublicDeckReadLimiter, getPublicDeckMissLimiter } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/ip";
import { buildPublicDeckPayload, PUBLIC_HEADERS } from "@/lib/share";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/public/decks/[slug]
 * Public read-only endpoint returning sanitized slide content.
 * Enforces rate limiting, 404 miss limiting, and zero-caching headers.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(req);

  // 1. Rate limit: 60 reads/min per IP
  const readLimiter = getPublicDeckReadLimiter();
  const readRes = await readLimiter.limit(ip).catch(() => ({ success: true }));
  if (!readRes.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...PUBLIC_HEADERS, "Retry-After": "60" } }
    );
  }

  const { slug } = await params;
  if (!slug || typeof slug !== "string" || slug.length < 5 || slug.length > 100) {
    const missLimiter = getPublicDeckMissLimiter();
    const missRes = await missLimiter.limit(ip).catch(() => ({ success: true }));
    if (!missRes.success) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please slow down." },
        { status: 429, headers: { ...PUBLIC_HEADERS, "Retry-After": "60" } }
      );
    }
    return NextResponse.json(
      { error: "Invalid presentation link." },
      { status: 404, headers: PUBLIC_HEADERS }
    );
  }

  await connectDB();
  const deck = await Deck.findOne({
    "share.slug": slug,
    "share.enabled": true,
  });

  if (!deck) {
    // 2. Rate limit: 20 slug misses (404s)/min per IP to prevent slug enumeration
    const missLimiter = getPublicDeckMissLimiter();
    const missRes = await missLimiter.limit(ip).catch(() => ({ success: true }));
    if (!missRes.success) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please slow down." },
        { status: 429, headers: { ...PUBLIC_HEADERS, "Retry-After": "60" } }
      );
    }

    return NextResponse.json(
      { error: "Presentation not found or access has been revoked." },
      { status: 404, headers: PUBLIC_HEADERS }
    );
  }

  const payload = await buildPublicDeckPayload(deck);

  return NextResponse.json(payload, {
    status: 200,
    headers: PUBLIC_HEADERS,
  });
}
