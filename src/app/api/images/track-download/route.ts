import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { trackUnsplashDownload } from "@/lib/image-search";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const downloadLocation = body?.downloadLocation;
    if (typeof downloadLocation === "string" && downloadLocation.trim()) {
      await trackUnsplashDownload(downloadLocation.trim());
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("track-download endpoint failed:", err);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
