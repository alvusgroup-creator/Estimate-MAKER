"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Plus, Settings, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/(auth)/login/actions";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/services", label: "Services", icon: Wrench },
  { href: "/settings", label: "Settings", icon: Settings },
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
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-surface md:sticky md:top-0 md:h-screen">
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg grid place-items-center text-white text-sm font-bold" style={{ background: primaryColor }}>
              {orgName.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-sm truncate">{orgName}</span>
        </div>
        <div className="p-3">
          <Link
            href="/estimates/new"
            className="flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
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
                isActive(href) ? "bg-black/5 font-medium" : "text-muted hover:bg-black/5 hover:text-foreground",
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
        <Link href="/estimates/new" className="flex flex-col items-center justify-center" aria-label="New estimate">
          <span className="h-11 w-11 -mt-5 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg">
            <Plus className="h-5 w-5" />
          </span>
        </Link>
        {items.slice(2, 4).map(({ href, label, icon: Icon }) => (
          <MobileItem key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
        ))}
      </nav>
    </>
  );
}

function MobileItem({ href, label, Icon, active }: { href: string; label: string; Icon: typeof FileText; active: boolean }) {
  return (
    <Link href={href} className={cn("flex flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-foreground font-medium" : "text-muted")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
