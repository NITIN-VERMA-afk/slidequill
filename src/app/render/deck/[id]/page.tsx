import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import User from "@/app/models/User";
import SlideRenderer from "@/components/app/SlideRenderer";
import { consumePrintToken } from "@/lib/print-token";
import { toPublicSlide } from "@/lib/share";
import { getTheme } from "@/lib/themes";

interface PrintPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Print Deck | SlideQuill",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  };
}

export default async function DeckPrintPage({
  params,
  searchParams,
}: PrintPageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  // Single-use token verification: burns token on first server render.
  // Query string is never logged to protect security.
  if (!token) {
    notFound();
  }

  const tokenResult = await consumePrintToken(token);
  if (!tokenResult.valid || !tokenResult.userId || !tokenResult.deckId) {
    notFound();
  }

  if (tokenResult.deckId !== id) {
    notFound();
  }

  await connectDB();
  const deck = await Deck.findOne({ _id: id, userId: tokenResult.userId }).lean();
  if (!deck) {
    notFound();
  }

  // Check if owner is free or paid to determine watermark
  const owner = await User.findById(tokenResult.userId).select("hasPurchased").lean();
  const showWatermark = !owner?.hasPurchased;

  // Explicitly sanitize and strip notes, _stash, internal meta
  const sanitizedSlides = (deck.slides || []).map((slide: any) =>
    toPublicSlide(slide)
  );

  const themeDef = getTheme(deck.theme || "modern");

  return (
    <div
      className="pdf-print-root bg-white text-slate-900 m-0 p-0"
      data-testid="pdf-print-root"
      data-slide-count={sanitizedSlides.length}
    >
      <style>{`
        @page {
          size: 1920px 1080px;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 1920px !important;
            height: 1080px !important;
            background: #ffffff !important;
          }
          .pdf-slide-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
          }
        }
        .pdf-slide-page {
          width: 1920px;
          height: 1080px;
          position: relative;
          overflow: hidden;
          background: #ffffff;
        }
      `}</style>

      {sanitizedSlides.map((slide: any, index: number) => (
        <section
          key={slide.id || index}
          className="pdf-slide-page relative flex flex-col justify-center"
          data-slide-index={index}
          style={{
            fontFamily: `"${themeDef.bodyFont.name}", ${themeDef.bodyFont.fallback}`,
          }}
        >
          <div className="w-full h-full relative">
            <SlideRenderer
              slide={slide as any}
              theme={deck.theme || "modern"}
              editable={false}
              className="w-full h-full"
            />
          </div>

          {showWatermark && (
            <div
              data-testid="watermark-badge"
              className="absolute bottom-6 right-8 text-sm font-semibold tracking-wide text-slate-400 select-none opacity-85 z-30 flex items-center gap-2 pointer-events-none"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Made with SlideQuill
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
