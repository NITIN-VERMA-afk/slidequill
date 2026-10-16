import { Skeleton } from "@/components/ui/skeleton";

export default function DeckEditorSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
      {/* Header row skeleton */}
      <div className="flex items-start justify-between gap-4 shrink-0 mb-2">
        <div className="flex-1 flex items-center gap-4">
          <Skeleton className="h-9 w-72 sm:w-96 rounded-xl" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden md:block h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Main Workspace Skeleton */}
      <div className="flex-1 min-h-0 flex gap-6 overflow-hidden">
        {/* Left Rail: Thumbnails skeleton */}
        <div className="w-48 shrink-0 flex flex-col gap-3 pr-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full aspect-video rounded-lg overflow-hidden border border-[#101A3A]/10 p-1 bg-white">
              <Skeleton className="h-full w-full rounded" />
            </div>
          ))}
        </div>

        {/* Center Canvas skeleton */}
        <div className="flex-1 flex flex-col items-center justify-center bg-white/60 rounded-2xl border border-[#101A3A]/10 p-6 shadow-sm">
          <div className="w-full max-w-4xl aspect-[16/9] rounded-xl overflow-hidden border border-[#101A3A]/10 bg-white p-8 flex flex-col justify-between shadow-md">
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3 rounded-lg" />
              <div className="space-y-3 pt-4">
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-8 border-t border-[#101A3A]/5">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        </div>

        {/* Right Panel skeleton */}
        <div className="hidden lg:flex w-80 shrink-0 flex-col border border-[#101A3A]/10 rounded-2xl overflow-hidden bg-white shadow-sm p-4 space-y-5">
          <div className="flex gap-2 border-b border-[#101A3A]/10 pb-3">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-20 rounded" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-[#101A3A]/10">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
