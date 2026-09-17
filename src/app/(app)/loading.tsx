import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function AppLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-3.5 w-24" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Card key={i} className="p-4 space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-24" /><Skeleton className="h-3 w-16" /></Card>)}
      </div>
      <Card className="divide-y divide-border">{[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</Card>
    </div>
  );
}
