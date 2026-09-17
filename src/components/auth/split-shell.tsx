import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-screen split used by login and onboarding: a photo on the left, the task on the right.
 * On phones the photo collapses to a short banner so the form is above the fold.
 */
export const SHELL_PHOTOS = {
  crew: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1600&q=80",
  house: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80",
  blueprint: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80",
  electrician: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=80",
  site: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80",
} as const;

export function SplitShell({ photo, children, aside, className }: { photo: string | ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] bg-surface">
      <div className="relative h-40 lg:h-auto lg:min-h-screen overflow-hidden bg-neutral-900">
        {typeof photo === "string" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          photo
        )}
        {aside}
      </div>
      <div className={cn("relative flex flex-col px-6 py-6 sm:px-10 lg:px-16 lg:py-8 min-h-[calc(100vh-10rem)] lg:min-h-screen", className)}>{children}</div>
    </main>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold text-lg", className)}>
      <span className="h-8 w-8 rounded-lg bg-accent text-white grid place-items-center text-sm font-bold">E</span>
      Estimate Builder
    </span>
  );
}
