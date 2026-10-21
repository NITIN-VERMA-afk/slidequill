import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { buildPublicDeckPayload } from "@/lib/share";
import PublicPresentationViewer from "@/components/app/PublicPresentationViewer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Presentation | SlideQuill" };

  await connectDB();
  const deck = await Deck.findOne({
    "share.slug": slug,
    "share.enabled": true,
  }).select("title");

  const title = deck?.title ? `${deck.title} | SlideQuill` : "Presentation | SlideQuill";

  return {
    title,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    },
  };
}

export default async function PublicDeckPage({ params }: PageProps) {
  const { slug } = await params;
  if (!slug || typeof slug !== "string" || slug.length < 5) {
    notFound();
  }

  await connectDB();
  const deck = await Deck.findOne({
    "share.slug": slug,
    "share.enabled": true,
  });

  if (!deck) {
    notFound();
  }

  const payload = await buildPublicDeckPayload(deck);

  return <PublicPresentationViewer deck={payload} />;
}
