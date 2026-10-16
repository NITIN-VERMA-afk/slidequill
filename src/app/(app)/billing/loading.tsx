import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>

      {/* Credit Balance Card skeleton */}
      <div className="rounded-2xl border border-[#101A3A]/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Plans Grid skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#101A3A]/10 bg-white p-6 shadow-sm space-y-5"
            >
              <div className="space-y-2">
                <Skeleton className="h-6 w-28 rounded-lg" />
                <Skeleton className="h-4 w-40 rounded" />
              </div>
              <Skeleton className="h-10 w-32 rounded-lg" />
              <div className="space-y-2.5 pt-4 border-t border-[#101A3A]/5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
              <Skeleton className="h-11 w-full rounded-xl pt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Payment History skeleton */}
      <div className="space-y-4 pt-4">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <div className="rounded-2xl border border-[#101A3A]/10 bg-white shadow-sm overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#101A3A]/5 last:border-none">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
