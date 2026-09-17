import type { CSSProperties } from "react";
import { requireOrg } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

/** Relative luminance → pick white or near-black text for a given background. */
function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111827" : "#ffffff";
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { org, user } = await requireOrg();

  // Org-chosen app color overrides the theme's primary + accent for the whole authenticated area
  const theme = org.appColor
    ? ({ "--primary": org.appColor, "--primary-foreground": readableOn(org.appColor), "--brand": org.appColor, "--brand-foreground": readableOn(org.appColor), "--accent": org.appColor, "--accent-soft": `color-mix(in srgb, ${org.appColor} 10%, white)` } as CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen md:flex" style={theme}>
      <AppNav orgName={org.name} logoUrl={org.logoUrl} primaryColor={org.appColor ?? org.primaryColor} userEmail={user.email} />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
