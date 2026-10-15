import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchMultipleStockImages } from "@/lib/image-search";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
