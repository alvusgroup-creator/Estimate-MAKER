"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-click (desktop) / long-press (touch) context menu.
 * Wrap any element: <ContextMenu items={...}><li>…</li></ContextMenu>.
 * Items are plain data so the same menu can be driven from server-rendered lists.
 */
export type MenuItem =
  | { type?: "item"; label: string; icon?: LucideIcon; onSelect?: () => void; href?: string; external?: boolean; danger?: boolean; disabled?: boolean; hint?: string }
  | { type: "separator" }
  | { type: "label"; label: string };

type Pos = { x: number; y: number };

const LONG_PRESS_MS = 450;

export function ContextMenu({ items, children, className, disabled, as: Tag = "div", onKeyDown }: { items: MenuItem[]; children: ReactNode; className?: string; disabled?: boolean; as?: "div" | "li" | "span" | "tr"; onKeyDown?: React.KeyboardEventHandler }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<Pos | null>(null);

  const open = useCallback((p: Pos) => { if (!disabled && items.length) setPos(p); }, [disabled, items.length]);
  const close = useCallback(() => setPos(null), []);

  const onContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    open({ x: e.clientX, y: e.clientY });
  };

  // Long-press for touch. Cancel if the finger moves (scroll) or lifts early.
  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    pressStart.current = { x: t.clientX, y: t.clientY };
    pressTimer.current = window.setTimeout(() => {
      if (pressStart.current) {
        open(pressStart.current);
        if ("vibrate" in navigator) navigator.vibrate?.(10);
      }
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => { if (pressTimer.current) window.clearTimeout(pressTimer.current); pressTimer.current = null; pressStart.current = null; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pressStart.current) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - pressStart.current.x, t.clientY - pressStart.current.y) > 10) cancelPress();
  };

  return (
    <Tag
      className={cn(Tag === "div" && !className ? "contents" : "", className)}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onKeyDown={onKeyDown}
      style={pos ? { WebkitTouchCallout: "none" } : undefined}
    >
      {children}
      {pos && <Menu items={items} pos={pos} onClose={close} />}
    </Tag>
  );
}

function Menu({ items, pos, onClose }: { items: MenuItem[]; pos: Pos; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<Pos>(pos);

  // Keep the menu inside the viewport
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(pos.x, window.innerWidth - r.width - 8);
    const y = Math.min(pos.y, window.innerHeight - r.height - 8);
    setPlaced({ x: Math.max(8, x), y: Math.max(8, y) });
    el.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [pos]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const els = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
      const i = els.indexOf(document.activeElement as HTMLElement);
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    };
    const onScroll = () => onClose();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: placed.x, top: placed.y }}
      className="fixed z-[100] min-w-[220px] max-w-[280px] rounded-xl border border-border bg-surface shadow-xl p-1.5 text-sm animate-in-menu select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it.type === "separator") return <div key={i} className="my-1 h-px bg-border" />;
        if (it.type === "label") return <div key={i} className="px-2.5 pt-1.5 pb-1 text-[11px] uppercase tracking-wider text-muted">{it.label}</div>;
        const Icon = it.icon;
        const cls = cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 h-9 text-left outline-none",
          it.disabled ? "opacity-40 cursor-default" : "hover:bg-black/5 focus:bg-black/5 cursor-pointer",
          it.danger && !it.disabled && "text-danger hover:bg-danger-soft focus:bg-danger-soft",
        );
        const inner = (
          <>
            {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
            <span className="flex-1 truncate">{it.label}</span>
            {it.hint && <span className="text-[11px] text-muted">{it.hint}</span>}
          </>
        );
        if (it.href && !it.disabled) {
          return (
            <a key={i} role="menuitem" tabIndex={0} href={it.href} className={cls} onClick={() => { onClose(); it.onSelect?.(); }} {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {inner}
            </a>
          );
        }
        return (
          <button
            key={i}
            role="menuitem"
            type="button"
            tabIndex={0}
            aria-disabled={it.disabled || undefined}
            className={cls}
            onClick={() => { if (it.disabled) return; onClose(); it.onSelect?.(); }}
          >
            {inner}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
