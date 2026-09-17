import { BRAND_YELLOW } from "./logo";
import { cn } from "@/lib/utils";

/** Brand loader: the invoice sheet stays put, the yellow arrow keeps taking off. */
export function BrandLoader({ size = 56, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)} role="status" aria-live="polite">
      <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M22 8 H74 L100 34 V104 A8 8 0 0 1 92 112 H30 A8 8 0 0 1 22 104 Z" fill="#0b0b0b" />
        <path d="M74 8 V28 A6 6 0 0 0 80 34 H100 Z" fill="#3f3f3f" />
        <rect x="52" y="70" width="34" height="7" rx="2" fill="#ffffff" />
        <rect x="52" y="84" width="34" height="7" rx="2" fill="#ffffff" />
        <path className="loader-arrow" d="M6 108 L66 46 L56 36 L92 28 L84 64 L74 54 L14 116 Z" fill={BRAND_YELLOW} />
      </svg>
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}
