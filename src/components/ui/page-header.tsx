import type { ReactNode } from "react";

/** The Home-style page header: yellow icon disc, title, one line of context, optional action on the right. */
export function PageHeader({ icon: Icon, title, subtitle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-11 w-11 rounded-full bg-brand text-brand-foreground grid place-items-center shrink-0"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
