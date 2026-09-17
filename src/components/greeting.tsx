"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Sunset } from "lucide-react";

/**
 * "Good morning, Jordan!" from the viewer's own clock (the server may be in another time zone).
 * Renders neutrally on the server, then updates once mounted and again every minute.
 */
export function Greeting({ name, orgName, locale }: { name: string; orgName: string; locale: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour = now?.getHours();
  const { text, Icon } =
    hour === undefined ? { text: "Welcome", Icon: Sun }
    : hour < 5 ? { text: "Working late", Icon: Moon }
    : hour < 12 ? { text: "Good morning", Icon: Sun }
    : hour < 18 ? { text: "Good afternoon", Icon: Sun }
    : hour < 22 ? { text: "Good evening", Icon: Sunset }
    : { text: "Good night", Icon: Moon };

  return (
    <div className="flex items-center gap-3">
      <span className="h-11 w-11 rounded-full bg-brand text-brand-foreground grid place-items-center shrink-0"><Icon className="h-5 w-5" /></span>
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{text}, {name}!</h1>
        <p className="text-sm text-muted">{orgName}{now ? ` · ${now.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })}` : ""}</p>
      </div>
    </div>
  );
}
