import { getSessionUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { Plus, FolderOpen, Zap, Clock } from "lucide-react";
import Link from "next/link";
import DeckCard from "@/components/app/DeckCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  
  await connectDB();
  // Fetch up to 3 most recent decks
  const recentDecksRaw = await Deck.find({ userId: user?.id })
    .select("title status sourceName theme createdAt coverImage slides")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const recentDecks = recentDecksRaw.map((d: any) => {
    const firstSlideWithImg = d.slides?.find((s: any) => s.content?.imageUrl);
    const coverImage = d.coverImage || firstSlideWithImg?.content?.imageUrl || null;
    return {
      _id: String(d._id),
      title: d.title,
      status: d.status,
      sourceName: d.sourceName,
      theme: d.theme,
      createdAt: d.createdAt,
      coverImage,
      slideCount: Array.isArray(d.slides) ? d.slides.length : 0,
    };
  });

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 space-y-5 md:space-y-6">
      {/* ── Fixed Top Section ────────────────────────────────────────────── */}
      <div className="shrink-0 space-y-4 md:space-y-5">
        {/* Welcome header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
              Good to see you, {user?.name?.split(" ")[0]} 👋
            </h2>
            <p className="mt-1 text-sm sm:text-base text-[#5a6384]">
              Your presentations, all in one place.
            </p>
          </div>
          <Link
            href="/decks/new"
            className="hidden sm:flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
          >
            <Plus size={16} /> New deck
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-3.5 sm:gap-5 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-2xl bg-[#101A3A] p-5 sm:p-6 md:p-7 shadow-md transition-all hover:shadow-xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="mb-3 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
                <Plus size={20} />
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white [font-family:var(--font-display)]">
                Create a new deck
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-white/70 max-w-sm mb-4 sm:mb-5">
                Turn a PDF, DOCX, or text into a polished presentation instantly. Takes about a minute.
              </p>
              <Link
                href="/decks/new"
                className="inline-flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
              >
                Start now →
              </Link>
            </div>
          </div>

          <div className="group rounded-2xl border border-[#101A3A]/10 bg-white p-5 sm:p-6 md:p-7 shadow-sm transition hover:border-[#2F5BFF]/30 hover:shadow-md flex flex-col justify-between">
            <div>
              <div className="mb-3 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-[#F4F6FB] text-[#2F5BFF]">
                <FolderOpen size={20} />
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
                My Decks
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#5a6384] mb-4 sm:mb-5">
                View, edit, and download all your previously generated slide decks.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Link
                href="/decks"
                className="inline-flex items-center text-xs sm:text-sm font-semibold text-[#2F5BFF] hover:underline"
              >
                View all decks →
              </Link>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5a6384] bg-[#F4F6FB] px-2.5 py-1.5 rounded-lg border border-[#101A3A]/5">
                <Zap size={14} className="text-orange-500" />
                {user?.credits} Credits left
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Recent Decks Section ──────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)] flex items-center gap-2">
            <Clock size={18} className="text-[#5a6384]"/>
            Recent Decks
          </h3>
          {recentDecks.length > 0 && (
             <Link href="/decks" className="text-sm font-semibold text-[#2F5BFF] hover:underline">
               View all
             </Link>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
          {recentDecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#101A3A]/10 bg-white py-12 sm:py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#F4F6FB] border border-[#101A3A]/5 shadow-sm">
                <FolderOpen size={26} className="text-[#2F5BFF]" />
              </div>
              <h3 className="mt-4 sm:mt-5 text-lg sm:text-xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
                No decks yet
              </h3>
              <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-[#5a6384] px-4">
                Upload a PDF or DOCX, let our AI generate your slides, and export an editable PowerPoint in seconds.
              </p>
              <Link
                href="/decks/new"
                className="mt-5 sm:mt-6 rounded-xl bg-[#101A3A] px-5 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition hover:bg-[#1d2c5e] hover:shadow-lg"
              >
                Create your first deck
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {recentDecks.map((deck) => (
                <li key={deck._id} className="h-full">
                  <DeckCard deck={deck} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
