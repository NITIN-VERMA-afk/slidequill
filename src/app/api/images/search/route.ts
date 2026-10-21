import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchMultipleStockImages } from "@/lib/image-search";
import { getImageSearchUserLimiter, getUnsplashGlobalLimiter } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const userLimit = await getImageSearchUserLimiter().limit(session.sub);
    if (!userLimit.success) {
      return NextResponse.json(
        {
          images: [],
          rateLimited: true,
          reason: "Too many image searches. Please wait a moment.",
        },
        { status: 200, headers: { "Retry-After": "60" } }
      );
    }

    const globalLimit = await getUnsplashGlobalLimiter().limit("global");
    if (!globalLimit.success) {
      return NextResponse.json(
        {
          images: [],
          rateLimited: true,
          quotaExceeded: true,
          reason: "Hourly stock photo quota reached. Please try again later.",
        },
        { status: 200, headers: { "Retry-After": "300" } }
      );
    }
  } catch {
    // If ratelimiter fails or redis is unavailable, proceed gracefully
  }

  const query = req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("query") || "business";
  try {
    const images = await searchMultipleStockImages(query, 6);
    return NextResponse.json({ images });
  } catch (err) {
    console.error("Image search error:", err);
    return NextResponse.json({ images: [] });
  }
}
