import { cn } from "@/lib/utils";
import type { EstimateStatus } from "@/generated/prisma/enums";

const statusStyles: Record<EstimateStatus, string> = {
  DRAFT: "bg-black/5 text-muted",
  SENT: "bg-accent-soft text-accent",
  VIEWED: "bg-warning-soft text-warning",
  ACCEPTED: "bg-success-soft text-success",
  DECLINED: "bg-danger-soft text-danger",
  EXPIRED: "bg-black/5 text-muted line-through",
};

export const statusLabels: Record<EstimateStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

export function StatusBadge({ status, className }: { status: EstimateStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[status], className)}>
      {statusLabels[status]}
    </span>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-muted", className)} {...props} />;
}
