import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Plus, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { DeckStatus } from "@/app/models/Deck";

const STATUS_META: Record<
  DeckStatus,
  { label: string; color: string; Icon: React.ElementType }
> = {
  draft:      { label: "Draft",      color: "text-[#5a6384] bg-[#F4F6FB]",             Icon: Clock },
  outlining:  { label: "Outlining",  color: "text-[#2F5BFF] bg-[#2F5BFF]/10",          Icon: Loader2 },
  outlined:   { label: "Outlined",   color: "text-emerald-700 bg-emerald-50",           Icon: CheckCircle2 },
  generating: { label: "Generating", color: "text-amber-700 bg-amber-50",               Icon: Loader2 },
  ready:      { label: "Ready",      color: "text-emerald-700 bg-emerald-50",           Icon: CheckCircle2 },
  failed:     { label: "Failed",     color: "text-red-600 bg-red-50",                   Icon: AlertCircle },
};

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const session = await getSession();
  if (!session?.sub) redirect("/login");

  await connectDB();
  const decks = await Deck.find({ userId: session.sub })
    .select("title status sourceName createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
            My Decks
          </h2>
          <p className="mt-1 text-sm text-[#5a6384]">
            {decks.length} deck{decks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/decks/new"
          className="flex items-center gap-2 rounded-xl bg-[#2F5BFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2449d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
        >
          <Plus size={16} /> New deck
        </Link>
      </div>

      {decks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
            <FolderOpen size={28} className="text-[#5a6384]" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">
            No decks yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-[#5a6384]">
            Create your first deck by uploading a PDF, DOCX, or pasting text.
          </p>
          <Link
            href="/decks/new"
            className="mt-6 rounded-xl bg-[#101A3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d2c5e]"
          >
            Make your first deck
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const status = deck.status as DeckStatus;
            const meta = STATUS_META[status] ?? STATUS_META.draft;
            const { Icon } = meta;
            const date = new Date(deck.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            return (
              <li key={String(deck._id)}>
                <Link
                  href={`/decks/${deck._id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[#101A3A]/10 bg-white p-5 shadow-sm transition hover:border-[#2F5BFF]/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5BFF]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-[#101A3A] [font-family:var(--font-display)]">
                      {deck.title || "Untitled"}
                    </h3>
                    <span
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}
                    >
                      <Icon size={10} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#5a6384]">
                    <span className="truncate">{deck.sourceName || "—"}</span>
                    <span className="shrink-0">{date}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
