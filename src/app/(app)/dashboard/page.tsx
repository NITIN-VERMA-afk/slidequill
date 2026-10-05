import { getSessionUser } from "@/lib/auth";
import { connectDB } from "@/app/lib/db";
import Deck from "@/app/models/Deck";
import { LayoutDashboard, Plus, FolderOpen, Zap, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
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

export default async function DashboardPage() {
  const user = await getSessionUser();
  
  await connectDB();
  // Fetch up to 3 most recent decks
  const recentDecks = await Deck.find({ userId: user?.id })
    .select("title status sourceName createdAt")
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-[#101A3A] [font-family:var(--font-display)]">
            Good to see you, {user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="mt-1 text-sm text-[#5a6384]">
            You have{" "}
            <span className="font-semibold text-[#101A3A]">
              {user?.credits} credit{user?.credits !== 1 ? "s" : ""}
            </span>{" "}
            remaining.
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
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#2F5BFF]/30">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF]">
            <Plus size={20} />
          </div>
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">Create Deck</h3>
          <p className="mt-1 text-sm text-[#5a6384] mb-4">Turn a document into a presentation instantly.</p>
          <Link href="/decks/new" className="inline-flex items-center text-sm font-semibold text-[#2F5BFF] hover:underline">
            Start now →
          </Link>
        </div>

        <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#2F5BFF]/30">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
            <FolderOpen size={20} />
          </div>
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">My Decks</h3>
          <p className="mt-1 text-sm text-[#5a6384] mb-4">View and manage all your generated slide decks.</p>
          <Link href="/decks" className="inline-flex items-center text-sm font-semibold text-purple-600 hover:underline">
            View all →
          </Link>
        </div>

        <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-[#2F5BFF]/30">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
            <Zap size={20} />
          </div>
          <h3 className="text-lg font-bold text-[#101A3A] [font-family:var(--font-display)]">Credits</h3>
          <p className="mt-1 text-sm text-[#5a6384] mb-4">You have {user?.credits} credits available.</p>
          <Link href="/billing" className="inline-flex items-center text-sm font-semibold text-orange-600 hover:underline">
            Manage billing →
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
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

        {recentDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#101A3A]/10 bg-white py-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#101A3A]/5">
              <LayoutDashboard size={28} className="text-[#5a6384]" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#101A3A] [font-family:var(--font-display)]">
              No activity yet
            </h3>
            <p className="mt-2 max-w-sm text-sm text-[#5a6384]">
              Create your first deck to get started. It takes about a minute.
            </p>
            <Link
              href="/decks/new"
              className="mt-6 rounded-xl bg-[#101A3A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d2c5e]"
            >
              Make your first deck
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentDecks.map((deck) => {
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
    </div>
  );
}
