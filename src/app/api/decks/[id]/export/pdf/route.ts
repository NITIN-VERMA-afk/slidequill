import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { getExportLimiter, getPdfDailyExportLimiter } from "@/lib/ratelimit";
import { checkOrigin } from "@/lib/csrf";
import { isValidObjectId } from "@/lib/validation";
import { acquirePdfExportLock, releasePdfExportLock } from "@/lib/export/pdf-lock";
import { generatePrintToken } from "@/lib/print-token";
import { renderDeckToPdf } from "@/lib/export/pdf";
import { trackEvent } from "@/lib/analytics";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function handlePdfExport(req: NextRequest, { params }: RouteParams) {
  if (req.method === "POST") {
    const originErr = checkOrigin(req);
    if (originErr) return originErr;
  }

  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid deck ID." }, { status: 400 });
  }

  // Rate limits: 5/min and 30/day per user
  const minLimiter = getExportLimiter();
  const minRes = await minLimiter.limit(session.sub).catch(() => ({ success: true }));
  if (!minRes.success) {
    return NextResponse.json(
      { error: "Too many export requests. Please wait a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const dayLimiter = getPdfDailyExportLimiter();
  const dayRes = await dayLimiter.limit(session.sub).catch(() => ({ success: true }));
  if (!dayRes.success) {
    return NextResponse.json(
      { error: "Daily export limit reached (30/day). Please try again tomorrow." },
      { status: 429, headers: { "Retry-After": "86400" } }
    );
  }

  // Acquire concurrency lock (max 1 concurrent PDF export per user)
  const { acquired, lockOwner } = await acquirePdfExportLock(session.sub);
  if (!acquired || !lockOwner) {
    return NextResponse.json(
      { error: "A PDF export is already in progress for your account. Please wait for it to complete." },
      { status: 429 }
    );
  }

  try {
    await connectDB();
    const deck = await Deck.findOne({ _id: id, userId: session.sub }).select("-sourceText").lean();
    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }

    if (deck.status !== "ready") {
      return NextResponse.json(
        { error: "Only decks in 'ready' status can be exported." },
        { status: 400 }
      );
    }

    const slides = deck.slides || [];
    if (slides.length > 60) {
      return NextResponse.json(
        { error: "Decks with more than 60 slides cannot be exported to PDF." },
        { status: 400 }
      );
    }

    // Generate single-use signed print token
    const printToken = await generatePrintToken({
      userId: session.sub,
      deckId: id,
    });

    const appOrigin =
      process.env.APP_URL || (req.nextUrl ? req.nextUrl.origin : "http://localhost:3000");

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderDeckToPdf({
        deckId: id,
        printToken,
        appOrigin,
        timeoutMs: 45000,
      });
    } catch (renderErr: any) {
      const isTimeout =
        renderErr?.name === "TimeoutError" ||
        renderErr?.message?.includes("timed out") ||
        renderErr?.message?.includes("Navigation timeout");

      if (isTimeout) {
        return NextResponse.json(
          { error: "PDF generation timed out. Please try exporting as PPTX or retry with fewer slides." },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: `PDF generation failed: ${renderErr?.message || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Log analytics event with format "pdf"
    void trackEvent("pdf_exported", {
      userId: session.sub,
      deckId: id,
      meta: { format: "pdf", slideCount: slides.length },
    });

    const safeTitle = (deck.title || "Presentation")
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } finally {
    if (lockOwner) {
      await releasePdfExportLock(session.sub, lockOwner).catch(() => {});
    }
  }
}

export async function POST(req: NextRequest, context: RouteParams) {
  return handlePdfExport(req, context);
}

export async function GET(req: NextRequest, context: RouteParams) {
  return handlePdfExport(req, context);
}
