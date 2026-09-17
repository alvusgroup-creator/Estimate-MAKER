import { cn } from "@/lib/utils";

/**
 * EasyInvoice brand, drawn as vectors so it never pixelates.
 * Mark: white sheet with a folded corner and two lines, yellow arrow rising out of it.
 * Wordmark: "Easy" + "Invoice" on a slanted yellow badge. Alvus yellow = #F5C518.
 */
export const BRAND_YELLOW = "#F5C518";

export function LogoMark({ className, size = 32, onDark = true }: { className?: string; size?: number; onDark?: boolean }) {
  const sheet = onDark ? "#ffffff" : "#0b0b0b";
  const lines = onDark ? "#0b0b0b" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M22 8 H74 L100 34 V104 A8 8 0 0 1 92 112 H30 A8 8 0 0 1 22 104 Z" fill={sheet} />
      <path d="M74 8 V28 A6 6 0 0 0 80 34 H100 Z" fill={onDark ? "#d4d4d4" : "#3f3f3f"} />
      <rect x="52" y="70" width="34" height="7" rx="2" fill={lines} />
      <rect x="52" y="84" width="34" height="7" rx="2" fill={lines} />
      <path d="M6 108 L66 46 L56 36 L92 28 L84 64 L74 54 L14 116 Z" fill={BRAND_YELLOW} />
    </svg>
  );
}

/** Full lockup. `tone` picks the wordmark color for the surface it sits on. */
export function Logo({ className, size = "md", tone = "dark", byline }: { className?: string; size?: "sm" | "md" | "lg" | "xl"; tone?: "dark" | "light"; byline?: boolean }) {
  const px = { sm: 22, md: 28, lg: 40, xl: 64 }[size];
  const text = { sm: "text-[17px]", md: "text-[22px]", lg: "text-[32px]", xl: "text-[52px]" }[size];
  const pad = { sm: "px-1.5 py-px", md: "px-2 py-0.5", lg: "px-3 py-1", xl: "px-4 py-1.5" }[size];
  const easy = tone === "dark" ? "text-white" : "text-[#0b0b0b]";
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className="inline-flex items-center" style={{ gap: px * 0.35 }}>
        <LogoMark size={px * 1.3} onDark={tone === "dark"} />
        <span className={cn("inline-flex items-center font-extrabold tracking-tight leading-none", text)} style={{ gap: px * 0.15 }}>
          <span className={easy}>Easy</span>
          <span className={cn("inline-block rounded-md text-[#0b0b0b]", pad)} style={{ background: BRAND_YELLOW, transform: "skewX(-6deg)" }}>
            <span className="inline-block" style={{ transform: "skewX(6deg)" }}>Invoice</span>
          </span>
        </span>
      </span>
      {byline && (
        <span className={cn("mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em]", tone === "dark" ? "text-white/60" : "text-neutral-500")} style={{ paddingLeft: px * 1.3 + px * 0.35 }}>
          by Alvus Group
        </span>
      )}
    </span>
  );
}
