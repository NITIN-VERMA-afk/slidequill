import { Skeleton } from "@/components/ui/skeleton";

export default function AppRootLoading() {
  return (
    <div className="flex flex-col h-full min-h-0 flex-1 space-y-6">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Content wireframe skeleton */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#101A3A]/10 bg-white p-5 shadow-sm space-y-4"
          >
            <Skeleton className="h-44 w-full rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
            </div>
            <div className="pt-2 border-t border-[#101A3A]/5 flex justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
