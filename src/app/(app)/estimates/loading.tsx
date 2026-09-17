import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function ListLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><Skeleton className="h-7 w-32" /><Skeleton className="h-10 w-20 rounded-lg" /></div>
      <div className="rounded-2xl border border-border bg-surface px-4 py-6 flex flex-col items-center gap-3">
        <Skeleton className="h-9 w-48 rounded-full" /><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-40" /><Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}</div>
      <Card className="divide-y divide-border">{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</Card>
    </div>
  );
}
