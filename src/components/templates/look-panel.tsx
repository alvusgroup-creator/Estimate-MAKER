"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Image as ImageIcon, LayoutTemplate, Palette } from "lucide-react";
import type { Template } from "@/generated/prisma/enums";
import type { OrgBranding } from "@/lib/estimates/dto";
import type { DocumentData } from "./estimate-document";
import { ScaledDocument } from "./scaled-document";
import { PALETTE, TEMPLATES } from "@/lib/templates";
import { saveDocumentColor } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

/**
 * "Preview & customize" strip under the full-size preview: real miniatures of every template
 * rendered with this document's data, and a one-tap brand color. Template is per document
 * (form value); color is the org's brand and saves immediately.
 */
export function LookPanel({ org, data, template, onTemplate, onColor }: {
  org: OrgBranding;
  data: DocumentData;
  template: Template;
  onTemplate: (t: Template) => void;
  onColor: (hex: string) => void;
}) {
  const [tab, setTab] = useState<"template" | "color">("template");
  const [, start] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  const pick = (hex: string) => {
    onColor(hex);
    start(async () => { const r = await saveDocumentColor(hex); if (r?.ok) { setSaved(hex); setTimeout(() => setSaved(null), 1200); } });
  };

  return (
    <div className="sticky bottom-0 z-10 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
      {tab === "template" ? (
        <div className="flex gap-3 overflow-x-auto px-4 py-3 snap-x">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => onTemplate(t.id)} className={cn("shrink-0 w-[124px] snap-start rounded-lg border-2 p-1 bg-neutral-100 text-left transition-colors", template === t.id ? "border-accent" : "border-transparent hover:border-muted")}>
              <ScaledDocument className="overflow-hidden rounded bg-white pointer-events-none" width={760} template={t.id} org={org} data={data} />
              <span className={cn("block text-[11px] font-medium px-1 pt-1", template === t.id ? "text-accent" : "text-muted")}>{t.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 flex flex-wrap items-center gap-2.5">
          {PALETTE.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => pick(c)} className={cn("h-9 w-9 rounded-full grid place-items-center transition-transform hover:scale-110 ring-offset-2", org.primaryColor.toLowerCase() === c ? "ring-2 ring-foreground scale-110" : "")} style={{ background: c }}>
              {org.primaryColor.toLowerCase() === c && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
            </button>
          ))}
          <span className="text-xs text-muted ml-2">{saved ? "Saved to your brand" : "Applies to all your documents"}</span>
        </div>
      )}
      <div className="grid grid-cols-3 border-t border-border text-[11px]">
        <TabButton active={tab === "template"} onClick={() => setTab("template")} icon={LayoutTemplate} label="Template" />
        <TabButton active={tab === "color"} onClick={() => setTab("color")} icon={Palette} label="Color" />
        <Link href="/settings?tab=branding" className="flex flex-col items-center gap-1 py-2 text-muted hover:text-foreground"><ImageIcon className="h-4 w-4" /> Logo</Link>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 py-2", active ? "text-accent font-medium" : "text-muted hover:text-foreground")}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
