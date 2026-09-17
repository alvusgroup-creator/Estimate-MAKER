"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { MousePointerClick, X } from "lucide-react";

/**
 * One-line tip that teaches the right-click / long-press menu. Dismissed by the X or
 * automatically the first time the user opens any context menu. Remembered per browser.
 */
export function DiscoveryHint({ id = "ctx-menu" }: { id?: string }) {
  const key = `hint:${id}`;
  // Read localStorage via an external-store subscription so SSR renders nothing and there's no setState-in-effect
  const seen = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => { try { return !!localStorage.getItem(key); } catch { return true; } },
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  const show = !seen && !dismissed;

  useEffect(() => {
    const dismiss = () => { try { localStorage.setItem(key, "1"); } catch {} setDismissed(true); };
    document.addEventListener("contextmenu", dismiss, { once: true, capture: true });
    return () => document.removeEventListener("contextmenu", dismiss, { capture: true });
  }, [key]);

  if (!show) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent-soft text-accent text-xs px-3 py-2">
      <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1"><b className="font-medium">Tip:</b> right-click a row, or press and hold on your phone, for quick actions.</span>
      <button type="button" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(key, "1"); } catch {} setDismissed(true); }}><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}
