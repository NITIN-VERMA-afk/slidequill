import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import { getSession } from "@/lib/auth";
import { getExportLimiter } from "@/lib/ratelimit";
import { buildPptx } from "@/lib/export/pptx";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Rate limit
  const limiter = getExportLimiter();
  const { success } = await limiter.limit(session.sub);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const { id } = await params;
  await connectDB();

  // Fetch deck
  const deck = await Deck.findOne({ _id: id, userId: session.sub }).select("-sourceText").lean();
  if (!deck) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (deck.status !== "ready") {
    return NextResponse.json({ error: "Deck is not ready for export." }, { status: 400 });
  }

  // Fetch user to check credits (assume <= 3 means free user who never bought credits)
  const user = await User.findById(session.sub).select("hasPurchased").lean();
  const isFreeUser = user ? !user.hasPurchased : true;

  try {
    const buffer = await buildPptx(deck.title, deck.slides as any[], deck.theme, isFreeUser);

    // Sanitize filename
    const safeTitle = (deck.title || "Presentation").replace(/[^a-zA-Z0-9-_\s]/g, "").trim().replace(/\s+/g, "_");
    const filename = safeTitle ? `${safeTitle}.pptx` : "Presentation.pptx";

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate PPTX." }, { status: 500 });
  }
}
