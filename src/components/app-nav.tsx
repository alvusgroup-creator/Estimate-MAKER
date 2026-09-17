"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Plus, Receipt, Settings, UserPlus, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/login/actions";
import { Logo } from "@/components/brand/logo";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const quickActions = [
  { href: "/estimates/new", label: "New estimate", sub: "Quote a job", icon: FileText },
  { href: "/clients/new", label: "New client", sub: "Add to your book", icon: UserPlus },
  { href: "/services?new=1", label: "New service", sub: "Add to price book", icon: Wrench },
  { href: "/settings", label: "Settings", sub: "Business, branding, defaults", icon: Settings },
] as const;

export function AppNav({ orgName, logoUrl, primaryColor, userEmail }: {
  orgName: string;
  logoUrl: string | null;
  primaryColor: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-surface md:sticky md:top-0 md:h-screen">
        <Link href="/dashboard" className="flex items-center px-5 h-16 border-b border-border">
          <Logo size="sm" tone="light" />
        </Link>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={orgName} className="h-9 w-9 rounded-lg object-contain bg-white border border-border" />
          ) : (
            <div className="h-9 w-9 rounded-lg grid place-items-center text-white text-sm font-bold" style={{ background: primaryColor }}>
              {orgName.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-sm leading-tight line-clamp-2 min-w-0">{orgName}</span>
        </div>
        <div className="p-3">
          <Link
            href="/estimates/new"
            className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New estimate
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 h-10 text-sm",
                isActive(href) ? "bg-accent-soft text-accent font-medium" : "text-muted hover:bg-black/5 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <form action={logout}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm text-muted hover:bg-black/5 hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="truncate">{userEmail}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border grid grid-cols-5 h-16 pb-[env(safe-area-inset-bottom)]">
        {items.slice(0, 2).map(({ href, label, icon: Icon }) => (
          <MobileItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
        ))}
        <QuickAddButton pathname={pathname} />
        {items.slice(2, 4).map(({ href, label, icon: Icon }) => (
          <MobileItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
        ))}
      </nav>
    </>
  );
}

function MobileItem({ href, label, Icon, active }: { href: string; label: string; Icon: typeof FileText; active: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-accent font-medium" : "text-muted")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

/** Center "+" — opens a small popover (no overlay) with the create actions. Closes on outside tap, Esc, or navigation. */
function QuickAddButton({ pathname }: { pathname: string }) {
  // Closing on navigation: key the open state by pathname instead of resetting it in an effect
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenAt((prev) => ((typeof v === "function" ? v(prev === pathname) : v) ? pathname : null));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpenAt(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenAt(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close" : "Create"}
        className={cn("h-12 w-12 -mt-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg transition-transform", open && "rotate-45")}
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-64 rounded-2xl border border-border bg-surface shadow-xl p-1.5 animate-in">
          {quickActions.map(({ href, label, sub, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-black/5 active:bg-black/10">
              <span className="h-9 w-9 rounded-lg bg-accent-soft text-accent grid place-items-center shrink-0"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{sub}</span>
              </span>
            </Link>
          ))}
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] h-3.5 w-3.5 rotate-45 bg-surface border-r border-b border-border" />
        </div>
      )}
    </div>
  );
}
