import { Skeleton } from "@/components/ui/skeleton";

export default function DeckCardSkeleton() {
  return (
    <div className="relative flex h-full w-full flex-col justify-between rounded-2xl border border-[#101A3A]/10 bg-white p-4 sm:p-5 shadow-sm">
      {/* Status badge skeleton */}
      <div className="absolute top-7 left-7 z-10">
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Thumbnail preview skeleton */}
      <div className="relative mb-4 h-44 sm:h-48 w-full shrink-0 overflow-hidden rounded-xl bg-[#101A3A]/5">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>

      {/* Title skeleton (reserved 2-line height) */}
      <div className="flex flex-1 flex-col justify-between">
        <div className="min-h-[2.75rem] space-y-2">
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </div>

        {/* Footer metadata skeleton */}
        <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-[#101A3A]/5">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}
