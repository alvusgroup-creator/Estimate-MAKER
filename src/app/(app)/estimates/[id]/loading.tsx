import { Skeleton } from "@/components/ui/skeleton";
import { BrandLoader } from "@/components/brand/loader";
import { Card } from "@/components/ui/card";

export default function DocumentLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3 w-32" /></div></div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <div className="rounded-xl border border-border bg-white min-h-[640px] p-8 sm:p-12 space-y-8">
          <div className="flex justify-between"><Skeleton className="h-9 w-40" /><Skeleton className="h-16 w-16 rounded-xl" /></div>
          <div className="grid grid-cols-3 gap-6">{[0, 1, 2].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-2.5 w-16" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>)}</div>
          <div className="space-y-3"><Skeleton className="h-9 w-full" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          <div className="flex justify-center pt-6"><BrandLoader size={44} label="Opening document…" /></div>
        </div>
        <div className="space-y-4">
          <Card className="p-4 space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-full rounded-lg" /><div className="grid grid-cols-2 gap-2"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-10 rounded-lg" /></div></Card>
          <Card className="p-4 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></Card>
        </div>
      </div>
    </div>
  );
}
