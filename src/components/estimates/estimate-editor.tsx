"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Eye, GripVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { computeTotals, formatMoney } from "@/lib/estimates/calc";
import { estimateFormSchema, UNIT_LABELS, type EstimateFormInput, type EstimateFormValues } from "@/lib/estimates/schemas";
import type { ClientDTO, EstimateDTO, OrgBranding, ServiceItemDTO } from "@/lib/estimates/dto";
import { createEstimate, updateEstimate } from "@/lib/estimates/actions";
import { createClientQuick } from "@/lib/clients/actions";
import { PhotoUploader } from "@/components/estimates/photo-uploader";
import { clientDisplayName, cn, daysFromNow } from "@/lib/utils";
import type { Template } from "@/generated/prisma/enums";

type Props = {
  org: OrgBranding & { defaultTaxRate: number; taxLabel: string; defaultTemplate: Template; defaultNotes: string | null; defaultTerms: string | null; defaultValidDays: number; defaultDepositType: "PERCENT" | "FIXED" | null; defaultDepositValue: number | null };
  clients: ClientDTO[];
  catalog: ServiceItemDTO[];
  estimate?: EstimateDTO; // undefined → create
  nextNumberPreview: string;
  preselectClientId?: string;
};

const toDateInput = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

export function EstimateEditor({ org, clients: initialClients, catalog, estimate, nextNumberPreview, preselectClientId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [clients, setClients] = useState(initialClients);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  const defaults: EstimateFormInput = estimate
    ? {
        clientId: estimate.clientId,
        title: estimate.title,
        template: estimate.template,
        issueDate: new Date(estimate.issueDate),
        expiresAt: estimate.expiresAt ? new Date(estimate.expiresAt) : null,
        jobAddressLine1: estimate.jobAddressLine1,
        jobAddressLine2: estimate.jobAddressLine2,
        jobCity: estimate.jobCity,
        jobState: estimate.jobState,
        jobPostalCode: estimate.jobPostalCode,
        notes: estimate.notes,
        terms: estimate.terms,
        internalNotes: estimate.internalNotes,
        discountType: estimate.discountType,
        discountValue: estimate.discountValue,
        taxRate: estimate.taxRate,
        taxLabel: estimate.taxLabel,
        depositType: estimate.depositType,
        depositValue: estimate.depositValue,
        dueDate: estimate.dueDate ? new Date(estimate.dueDate) : null,
        lineItems: estimate.lineItems.map((l) => ({ ...l, description: l.description ?? null })),
        photos: estimate.photos.map((p) => ({ url: p.url, caption: p.caption, showOnDocument: p.showOnDocument })),
      }
    : {
        clientId: preselectClientId ?? "",
        title: null,
        template: org.defaultTemplate,
        issueDate: new Date(),
        expiresAt: daysFromNow(org.defaultValidDays),
        jobAddressLine1: null, jobAddressLine2: null, jobCity: null, jobState: null, jobPostalCode: null,
        notes: org.defaultNotes,
        terms: org.defaultTerms,
        internalNotes: null,
        discountType: null,
        discountValue: null,
        taxRate: org.defaultTaxRate,
        taxLabel: org.taxLabel,
        depositType: org.defaultDepositType,
        depositValue: org.defaultDepositValue,
        dueDate: null,
        lineItems: [],
        photos: [],
      };

  const form = useForm<EstimateFormInput, unknown, EstimateFormValues>({ resolver: zodResolver(estimateFormSchema), defaultValues: defaults, mode: "onBlur" });
  const { control, register, handleSubmit, setValue, formState: { errors } } = form;
  const lines = useFieldArray({ control, name: "lineItems" });
  const values = useWatch({ control });

  const totals = useMemo(
    () =>
      computeTotals({
        lines: (values.lineItems ?? []).map((l) => ({ quantity: Number(l?.quantity) || 0, unitPrice: Number(l?.unitPrice) || 0, taxable: !!l?.taxable, isOptional: !!l?.isOptional })),
        discountType: values.discountType ?? null,
        discountValue: values.discountValue != null ? Number(values.discountValue) : null,
        taxRate: Number(values.taxRate) || 0,
        depositType: values.depositType ?? null,
        depositValue: values.depositValue != null ? Number(values.depositValue) : null,
      }),
    [values],
  );

  const isInvoice = estimate?.kind === "INVOICE";
  const photos = (values.photos ?? []) as { url: string; caption: string | null; showOnDocument: boolean }[];
  const selectedClient = clients.find((c) => c.id === values.clientId);
  const money = (n: number) => formatMoney(n, org.currency, org.locale);

  function addFromCatalog(item: ServiceItemDTO) {
    lines.append({ serviceItemId: item.id, name: item.name, description: item.description, quantity: 1, unit: item.unit, unitPrice: item.unitPrice, taxable: item.taxable, isOptional: false });
  }
  function addBlank() {
    lines.append({ serviceItemId: null, name: "", description: null, quantity: 1, unit: "EACH", unitPrice: 0, taxable: true, isOptional: false });
  }

  function onClientPicked(id: string) {
    setValue("clientId", id, { shouldValidate: true });
    const c = clients.find((x) => x.id === id);
    // Pre-fill job site with the client's address when the job site is still empty
    if (c && !values.jobAddressLine1) {
      setValue("jobAddressLine1", c.addressLine1);
      setValue("jobAddressLine2", c.addressLine2);
      setValue("jobCity", c.city);
      setValue("jobState", c.state);
      setValue("jobPostalCode", c.postalCode);
    }
  }

  const submit = handleSubmit((data) => {
    setServerError(null);
    start(async () => {
      const res = estimate ? await updateEstimate(estimate.id, data) : await createEstimate(data);
      if (!res.ok) return setServerError(res.error);
      router.push(`/estimates/${res.id}`);
    });
  });

  const previewData = {
    number: estimate?.number ?? nextNumberPreview,
    title: values.title,
    issueDate: (values.issueDate as Date | undefined) ?? new Date(),
    expiresAt: (values.expiresAt as Date | null | undefined) ?? null,
    client: selectedClient ?? { id: "", firstName: "Client name", lastName: null, companyName: null, email: null, phone: null, addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null },
    jobAddress: { addressLine1: values.jobAddressLine1, addressLine2: values.jobAddressLine2, city: values.jobCity, state: values.jobState, postalCode: values.jobPostalCode },
    lines: (values.lineItems ?? []).map((l, i) => ({
      name: l?.name || "Untitled item",
      description: l?.description,
      quantity: Number(l?.quantity) || 0,
      unit: (l?.unit ?? "EACH") as keyof typeof UNIT_LABELS,
      unitPrice: Number(l?.unitPrice) || 0,
      lineTotal: totals.lineTotals[i] ?? 0,
      isOptional: !!l?.isOptional,
    })),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxLabel: values.taxLabel ?? "Sales Tax",
    taxRate: Number(values.taxRate) || 0,
    taxAmount: totals.taxAmount,
    total: totals.total,
    depositAmount: totals.depositAmount,
    notes: values.notes,
    terms: values.terms,
    kind: (estimate?.kind ?? "ESTIMATE") as "ESTIMATE" | "INVOICE",
    dueDate: (values.dueDate as Date | null | undefined) ?? null,
    photos: photos.filter((p) => p.showOnDocument).map((p) => ({ url: p.url, caption: p.caption })),
  };

  return (
    <form onSubmit={submit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:items-start">
      {/* ── Editor column ── */}
      <div className={cn("space-y-4", mobileView === "preview" && "hidden lg:block")}>
        <Card>
          <CardBody className="space-y-4">
            <Field label="Client" error={errors.clientId?.message}>
              <ClientPicker clients={clients} value={values.clientId ?? ""} onChange={onClientPicked} onCreated={(c) => { setClients((p) => [c, ...p]); onClientPicked(c.id); }} />
            </Field>
            <Field label="Title (optional)">
              <Input {...register("title")} placeholder="Exterior repaint — 123 Main St" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" {...register("issueDate", { setValueAs: (v) => (v ? new Date(v) : new Date()) })} defaultValue={toDateInput(defaults.issueDate as Date)} />
              </Field>
              {isInvoice ? (
                <Field label="Due date">
                  <Input type="date" {...register("dueDate", { setValueAs: (v) => (v ? new Date(v) : null) })} defaultValue={defaults.dueDate ? toDateInput(defaults.dueDate as Date) : ""} />
                </Field>
              ) : (
                <Field label="Valid until">
                  <Input type="date" {...register("expiresAt", { setValueAs: (v) => (v ? new Date(v) : null) })} defaultValue={defaults.expiresAt ? toDateInput(defaults.expiresAt as Date) : ""} />
                </Field>
              )}
            </div>
            <Collapsible title="Job site address" defaultOpen={false}>
              <div className="grid grid-cols-6 gap-3">
                <Input className="col-span-6" placeholder="Street" {...register("jobAddressLine1")} />
                <Input className="col-span-6" placeholder="Unit / suite (optional)" {...register("jobAddressLine2")} />
                <Input className="col-span-3" placeholder="City" {...register("jobCity")} />
                <Input className="col-span-1 uppercase" placeholder="ST" maxLength={2} {...register("jobState")} />
                <Input className="col-span-2" placeholder="ZIP" {...register("jobPostalCode")} />
              </div>
            </Collapsible>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
            <span className="text-xs text-muted">{lines.fields.length} item{lines.fields.length === 1 ? "" : "s"}</span>
          </CardHeader>
          <CardBody className="space-y-3">
            <CatalogSearch catalog={catalog} onPick={addFromCatalog} onBlank={addBlank} />
            {errors.lineItems?.root?.message || (typeof errors.lineItems?.message === "string" && errors.lineItems.message) ? (
              <p className="text-xs text-danger">{errors.lineItems.root?.message ?? errors.lineItems.message}</p>
            ) : null}
            <div className="space-y-2">
              {lines.fields.map((f, i) => (
                <LineRow key={f.id} index={i} control={control} register={register} onRemove={() => lines.remove(i)} lineTotal={totals.lineTotals[i] ?? 0} money={money} error={errors.lineItems?.[i]} />
              ))}
            </div>
            {lines.fields.length === 0 && <p className="text-sm text-muted text-center py-6">Search your services above or add a blank line.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job photos</CardTitle>
            <span className="text-xs text-muted">{photos.length}/20</span>
          </CardHeader>
          <CardBody>
            <PhotoUploader value={photos} onChange={(v) => setValue("photos", v, { shouldDirty: true })} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount">
                <div className="flex gap-2">
                  <Select className="w-24" {...register("discountType", { setValueAs: (v) => (v === "" ? null : v) })}>
                    <option value="">None</option>
                    <option value="PERCENT">%</option>
                    <option value="FIXED">$</option>
                  </Select>
                  <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("discountValue", { setValueAs: (v) => (v === "" ? null : Number(v)) })} disabled={!values.discountType} />
                </div>
              </Field>
              <Field label={`${values.taxLabel ?? "Tax"} rate (%)`}>
                <Input type="number" inputMode="decimal" step="0.01" min="0" max="100" {...register("taxRate", { setValueAs: (v) => (v === "" ? 0 : Number(v) / 100) })} defaultValue={(Number(defaults.taxRate) * 100).toString()} />
              </Field>
            </div>
            <Field label={isInvoice ? "Deposit already paid" : "Deposit due on acceptance"}>
              <div className="flex gap-2">
                <Select className="w-24" {...register("depositType", { setValueAs: (v) => (v === "" ? null : v) })}>
                  <option value="">None</option>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">$</option>
                </Select>
                <Input type="number" inputMode="decimal" step="0.01" min="0" {...register("depositValue", { setValueAs: (v) => (v === "" ? null : Number(v)) })} disabled={!values.depositType} />
              </div>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes & terms</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <Field label="Notes to customer">
              <Textarea {...register("notes")} placeholder="Scope details, what's included, scheduling…" />
            </Field>
            <Field label="Terms">
              <Textarea {...register("terms")} className="min-h-[120px]" />
            </Field>
            <Collapsible title="Internal notes (never shown to the customer)" defaultOpen={false}>
              <Textarea {...register("internalNotes")} />
            </Collapsible>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Template</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              {(["CLEAN", "BOLD", "CLASSIC"] as Template[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue("template", t)}
                  className={cn("rounded-lg border-2 p-2 text-left text-xs", values.template === t ? "border-accent bg-accent-soft" : "border-border hover:border-muted")}
                >
                  <TemplateThumb template={t} color={org.primaryColor} />
                  <span className="block mt-2 font-medium capitalize">{t.toLowerCase()}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ── Preview column ── */}
      <div className={cn("lg:sticky lg:top-6", mobileView === "edit" && "hidden lg:block")}>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <EstimateDocument template={(values.template ?? "CLEAN") as Template} org={org} data={previewData} />
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:left-60 z-30 bg-surface/95 backdrop-blur border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted">Total</p>
            <p className="text-lg font-semibold tabular-nums leading-tight">{money(totals.total)}</p>
          </div>
          <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setMobileView((v) => (v === "edit" ? "preview" : "edit"))}>
            {mobileView === "edit" ? <><Eye className="h-4 w-4" /> Preview</> : <><Pencil className="h-4 w-4" /> Edit</>}
          </Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : estimate ? "Save changes" : "Save estimate"}</Button>
        </div>
        {serverError && <p className="px-4 pb-2 text-xs text-danger">{serverError}</p>}
      </div>
      <div className="h-20" />
    </form>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function LineRow({ index, control, register, onRemove, lineTotal, money, error }: {
  index: number;
  control: Control<EstimateFormInput>;
  register: UseFormRegister<EstimateFormInput>;
  onRemove: () => void;
  lineTotal: number;
  money: (n: number) => string;
  error?: { name?: { message?: string } };
}) {
  const [open, setOpen] = useState(false);
  const desc = useWatch({ control, name: `lineItems.${index}.description` });
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted/50 mt-3 hidden sm:block" />
        <div className="flex-1 min-w-0 space-y-2">
          <Input placeholder="Item name" {...register(`lineItems.${index}.name`)} className={cn("font-medium", error?.name && "border-danger")} />
          <div className="grid grid-cols-[1fr_auto_1fr_auto] sm:grid-cols-[80px_90px_1fr_110px] gap-2 items-center">
            <Input type="number" inputMode="decimal" step="any" min="0" aria-label="Quantity" {...register(`lineItems.${index}.quantity`)} />
            <Select aria-label="Unit" {...register(`lineItems.${index}.unit`)}>
              {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <Input type="number" inputMode="decimal" step="0.01" min="0" aria-label="Unit price" className="pl-7" {...register(`lineItems.${index}.unitPrice`)} />
            </div>
            <span className="text-sm font-medium tabular-nums text-right whitespace-nowrap">{money(lineTotal)}</span>
          </div>
          {(open || desc) && <Textarea placeholder="Description (shown on the estimate)" className="min-h-[56px]" {...register(`lineItems.${index}.description`)} />}
          <div className="flex items-center gap-4 text-xs text-muted">
            {!open && !desc && <button type="button" className="hover:text-foreground" onClick={() => setOpen(true)}>+ description</button>}
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" {...register(`lineItems.${index}.taxable`)} /> taxable</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" {...register(`lineItems.${index}.isOptional`)} /> optional</label>
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove line"><Trash2 className="h-4 w-4 text-muted" /></Button>
      </div>
    </div>
  );
}

function CatalogSearch({ catalog, onPick, onBlank }: { catalog: ServiceItemDTO[]; onPick: (s: ServiceItemDTO) => void; onBlank: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? catalog.filter((c) => c.name.toLowerCase().includes(s) || c.category?.toLowerCase().includes(s)) : catalog;
    return list.slice(0, 8);
  }, [q, catalog]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search your services…"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="secondary" onClick={onBlank}><Plus className="h-4 w-4" /> Blank</Button>
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s); setQ(""); setOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-background flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{s.name}</span>
                  {s.category && <span className="block text-xs text-muted">{s.category}</span>}
                </span>
                <span className="text-xs text-muted whitespace-nowrap tabular-nums">${s.unitPrice.toFixed(2)} / {UNIT_LABELS[s.unit]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientPicker({ clients, value, onChange, onCreated }: { clients: ClientDTO[]; value: string; onChange: (id: string) => void; onCreated: (c: ClientDTO) => void }) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (adding) {
    return (
      <div className="rounded-lg border border-border p-3 space-y-2 bg-background/60">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">New client</p>
          <button type="button" onClick={() => setAdding(false)} aria-label="Cancel"><X className="h-4 w-4 text-muted" /></button>
        </div>
        <QuickClientForm
          pending={pending}
          error={err}
          onSubmit={(data) => start(async () => {
            const r = await createClientQuick(data);
            if (!r.ok) return setErr(r.error);
            onCreated(r.client);
            setAdding(false);
          })}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1">
        <option value="">Select a client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
      </Select>
      <Button type="button" variant="secondary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New</Button>
    </div>
  );
}

function QuickClientForm({ onSubmit, pending, error }: { onSubmit: (d: Record<string, string>) => void; pending: boolean; error: string | null }) {
  const [d, setD] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setD((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="First name *" value={d.firstName ?? ""} onChange={set("firstName")} />
        <Input placeholder="Last name" value={d.lastName ?? ""} onChange={set("lastName")} />
      </div>
      <Input placeholder="Phone" type="tel" inputMode="tel" value={d.phone ?? ""} onChange={set("phone")} />
      <Input placeholder="Email" type="email" inputMode="email" value={d.email ?? ""} onChange={set("email")} />
      <Input placeholder="Street address" value={d.addressLine1 ?? ""} onChange={set("addressLine1")} />
      <div className="grid grid-cols-6 gap-2">
        <Input className="col-span-3" placeholder="City" value={d.city ?? ""} onChange={set("city")} />
        <Input className="col-span-1 uppercase" placeholder="ST" maxLength={2} value={d.state ?? ""} onChange={set("state")} />
        <Input className="col-span-2" placeholder="ZIP" value={d.postalCode ?? ""} onChange={set("postalCode")} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button type="button" size="sm" disabled={pending || !d.firstName} onClick={() => onSubmit(d)}>{pending ? "Adding…" : "Add client"}</Button>
    </div>
  );
}

function Collapsible({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} /> {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function TemplateThumb({ template, color }: { template: Template; color: string }) {
  return (
    <div className="aspect-[3/4] w-full rounded bg-white border border-border overflow-hidden p-1.5 flex flex-col gap-1">
      {template === "BOLD" ? (
        <div className="h-3 rounded-sm" style={{ background: color }} />
      ) : template === "CLASSIC" ? (
        <div className="h-3 border-b-2 border-neutral-800 flex justify-center"><div className="w-1/2 h-1.5 bg-neutral-300 rounded-sm" /></div>
      ) : (
        <div className="flex justify-between"><div className="h-2 w-2 rounded-sm" style={{ background: color }} /><div className="h-2 w-1/3 bg-neutral-200 rounded-sm" /></div>
      )}
      <div className="mt-1 space-y-0.5 flex-1">
        {[0, 1, 2].map((i) => <div key={i} className="h-1 bg-neutral-200 rounded-sm" style={{ width: `${90 - i * 15}%` }} />)}
      </div>
      <div className="h-1.5 w-1/3 self-end rounded-sm" style={{ background: template === "CLASSIC" ? "#333" : color }} />
    </div>
  );
}
