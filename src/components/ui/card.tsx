import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-surface transition-shadow duration-200", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 px-4 py-3 border-b border-border", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function EmptyState({ title, description, action, icon: Icon, tone = "accent" }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "accent" | "warm" | "success";
}) {
  const tile = { accent: "bg-accent-soft text-accent", warm: "bg-warning-soft text-warning", success: "bg-success-soft text-success" }[tone];
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {Icon && <div className={cn("h-14 w-14 rounded-2xl grid place-items-center mb-3", tile)}><Icon className="h-7 w-7" /></div>}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
