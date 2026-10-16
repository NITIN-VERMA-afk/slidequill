import { Skeleton } from "@/components/ui/skeleton";
import DeckCardSkeleton from "@/components/app/DeckCardSkeleton";

export default function DecksLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40 rounded-xl" />
          <Skeleton className="h-4 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="h-full">
            <DeckCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
