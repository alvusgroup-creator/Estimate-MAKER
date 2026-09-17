import { cn } from "@/lib/utils";

/** Grey shimmer block that stands in for content while a page loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** A list row: avatar, two text lines, an amount. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-3/5" /></div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}
