import { Skeleton } from "@/components/ui/skeleton";
import DeckCardSkeleton from "@/components/app/DeckCardSkeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full min-h-0 flex-1 space-y-5 md:space-y-6">
      {/* ── Fixed Top Section Skeleton ─────────────────────────────────── */}
      <div className="shrink-0 space-y-4 md:space-y-5">
        {/* Welcome header skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 sm:h-9 w-64 rounded-xl" />
            <Skeleton className="h-4 w-80 max-w-sm rounded-lg" />
          </div>
          <Skeleton className="hidden sm:block h-10 w-36 rounded-xl" />
        </div>

        {/* Quick action cards skeleton */}
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Decks Header & Grid Skeleton ────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between shrink-0">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">
          <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-full">
                <DeckCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
