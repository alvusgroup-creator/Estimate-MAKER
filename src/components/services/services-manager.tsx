"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/card";
import { UNIT_LABELS } from "@/lib/estimates/schemas";
import { formatMoney } from "@/lib/estimates/calc";
import { archiveService, saveService } from "@/lib/services/actions";
import type { ServiceItemDTO } from "@/lib/estimates/dto";
import { cn } from "@/lib/utils";

type Draft = { name: string; description: string; category: string; unit: keyof typeof UNIT_LABELS; unitPrice: string; taxable: boolean; isMaterial: boolean };
const empty: Draft = { name: "", description: "", category: "", unit: "EACH", unitPrice: "", taxable: true, isMaterial: false };

export function ServicesManager({ initial, currency, locale }: { initial: ServiceItemDTO[]; currency: string; locale: string }) {
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category ?? "Other"))].sort(), [items]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.name.toLowerCase().includes(s) || i.category?.toLowerCase().includes(s)) : items;
  }, [items, q]);
  const grouped = useMemo(() => {
    const m = new Map<string, ServiceItemDTO[]>();
    for (const i of filtered) {
      const k = i.category ?? "Other";
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const upsert = (item: ServiceItemDTO) => setItems((p) => (p.some((x) => x.id === item.id) ? p.map((x) => (x.id === item.id ? item : x)) : [item, ...p]));
  const remove = (id: string) => setItems((p) => p.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="pl-9" />
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {editing === "new" && (
        <ServiceEditor draft={empty} categories={categories} onCancel={() => setEditing(null)} onSaved={(i) => { upsert(i); setEditing(null); }} />
      )}

      {grouped.length === 0 ? (
        <Card><EmptyState title={q ? "No matches" : "No services yet"} description={q ? undefined : "Add the services you quote most. They become one-tap line items in the estimate builder."} /></Card>
      ) : (
        grouped.map(([cat, list]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 px-1">{cat}</h2>
            <Card>
              <ul className="divide-y divide-border">
                {list.map((s) =>
                  editing === s.id ? (
                    <li key={s.id} className="p-3">
                      <ServiceEditor
                        id={s.id}
                        draft={{ name: s.name, description: s.description ?? "", category: s.category ?? "", unit: s.unit, unitPrice: String(s.unitPrice), taxable: s.taxable, isMaterial: false }}
                        categories={categories}
                        onCancel={() => setEditing(null)}
                        onSaved={(i) => { upsert(i); setEditing(null); }}
                        onArchived={() => { remove(s.id); setEditing(null); }}
                      />
                    </li>
                  ) : (
                    <li key={s.id}>
                      <button type="button" onClick={() => setEditing(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.description && <p className="text-xs text-muted truncate">{s.description}</p>}
                        </div>
                        <span className="text-sm tabular-nums whitespace-nowrap">
                          {formatMoney(s.unitPrice, currency, locale)} <span className="text-muted text-xs">/ {UNIT_LABELS[s.unit]}</span>
                        </span>
                        <Pencil className="h-4 w-4 text-muted/60" />
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

function ServiceEditor({ id, draft, categories, onCancel, onSaved, onArchived }: {
  id?: string;
  draft: Draft;
  categories: string[];
  onCancel: () => void;
  onSaved: (i: ServiceItemDTO) => void;
  onArchived?: () => void;
}) {
  const [d, setD] = useState(draft);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      setErr(null);
      const r = await saveService(id ?? null, { ...d, description: d.description || null, category: d.category || null, unitPrice: d.unitPrice === "" ? 0 : Number(d.unitPrice) });
      if (!r.ok) return setErr(r.error);
      onSaved(r.item);
    });

  return (
    <Card className={cn("p-4 space-y-3", !id && "border-accent")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{id ? "Edit service" : "New service"}</p>
        <button type="button" onClick={onCancel} aria-label="Cancel"><X className="h-4 w-4 text-muted" /></button>
      </div>
      <Field label="Name *"><Input value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus placeholder="Interior Painting — Walls" /></Field>
      <Field label="Description (shows on the estimate)"><Textarea value={d.description} onChange={(e) => set("description", e.target.value)} className="min-h-[56px]" placeholder="Two coats premium paint, patch & prep included" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <Input type="number" inputMode="decimal" step="0.01" min="0" className="pl-7" value={d.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} />
          </div>
        </Field>
        <Field label="Per">
          <Select value={d.unit} onChange={(e) => set("unit", e.target.value as Draft["unit"])}>
            {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Category">
          <Input list="svc-categories" value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="Painting" />
          <datalist id="svc-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={d.taxable} onChange={(e) => set("taxable", e.target.checked)} /> Taxable</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={d.isMaterial} onChange={(e) => set("isMaterial", e.target.checked)} /> Material (not labor)</label>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={pending || !d.name.trim()}>{pending ? "Saving…" : "Save"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        {id && onArchived && (
          <Button variant="ghost" size="sm" className="ml-auto text-danger" disabled={pending} onClick={() => confirm("Remove this service from your catalog? Existing estimates keep their lines.") && start(async () => { await archiveService(id); onArchived(); })}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>
    </Card>
  );
}
