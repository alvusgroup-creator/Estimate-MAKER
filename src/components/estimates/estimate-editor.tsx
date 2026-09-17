"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowLeft, ArrowUp, BookmarkPlus, ChevronDown, CopyPlus, Eye, GripVertical, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { ContextMenu, type MenuItem } from "@/components/ui/context-menu";
import { saveService } from "@/lib/services/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { LookPanel } from "@/components/templates/look-panel";
import { ScaledDocument } from "@/components/templates/scaled-document";
import { computeTotals, formatMoney } from "@/lib/estimates/calc";
import { changeOrderFormSchema, estimateFormSchema, UNIT_LABELS, type EstimateFormInput, type EstimateFormValues } from "@/lib/estimates/schemas";
import type { ClientDTO, EstimateDTO, OrgBranding, ParentEstimateDTO, ServiceItemDTO } from "@/lib/estimates/dto";
import { createChangeOrder, createEstimate, updateEstimate } from "@/lib/estimates/actions";
import { createClientQuick } from "@/lib/clients/actions";
import { PhotoUploader } from "@/components/estimates/photo-uploader";
import { clientDisplayName, cn, daysFromNow, docWords } from "@/lib/utils";
import type { Template } from "@/generated/prisma/enums";
import { TEMPLATES } from "@/lib/templates";

type Props = {
  org: OrgBranding & { defaultTaxRate: number; taxLabel: string; defaultTemplate: Template; defaultNotes: string | null; defaultTerms: string | null; defaultValidDays: number; defaultDepositType: "PERCENT" | "FIXED" | null; defaultDepositValue: number | null };
  clients: ClientDTO[];
  catalog: ServiceItemDTO[];
  estimate?: EstimateDTO; // undefined → create
  changeOrderOf?: EstimateDTO; // create a change order on this accepted estimate (client, address, tax inherited)
  nextNumberPreview: string;
  preselectClientId?: string;
};

const toDateInput = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/**
 * The editor reads like the document it produces: number and dates on top, then client,
 * items, totals, notes. The full-size document opens with "Preview" instead of living in a
 * squeezed side column. Logic (catalog search, quick client, photos, change-order mode) is unchanged.
 */
export function EstimateEditor({ org, clients: initialClients, catalog, estimate, changeOrderOf, nextNumberPreview, preselectClientId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [clients, setClients] = useState(initialClients);
  const [preview, setPreview] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor); // brand color picked from the preview panel
  const docOrg = { ...org, primaryColor };
  const [catalogLocal, setCatalogLocal] = useState(catalog);
  const [toast, setToast] = useState<string | null>(null);
  const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // Change-order mode: new CO on an accepted estimate, or editing an existing CO
  const isChangeOrder = !!changeOrderOf || estimate?.kind === "CHANGE_ORDER";
  const isInvoice = estimate?.kind === "INVOICE";
  const kind = (isChangeOrder ? "CHANGE_ORDER" : isInvoice ? "INVOICE" : "ESTIMATE") as "ESTIMATE" | "INVOICE" | "CHANGE_ORDER";
  const { Word } = docWords(kind);
  const parent: ParentEstimateDTO | null = changeOrderOf
    ? { id: changeOrderOf.id, number: changeOrderOf.number, title: changeOrderOf.title, total: changeOrderOf.total, priorChangesTotal: changeOrderOf.changeOrders.filter((c) => c.status === "ACCEPTED").reduce((sum, c) => sum + c.total, 0) }
    : estimate?.parent ?? null;
  const numberPreview = estimate?.number ?? (changeOrderOf ? `${changeOrderOf.number}-CO${changeOrderOf.changeOrders.length + 1}` : nextNumberPreview);

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
    : changeOrderOf
      ? {
          clientId: changeOrderOf.clientId,
          title: null,
          template: changeOrderOf.template,
          issueDate: new Date(),
          expiresAt: null,
          jobAddressLine1: changeOrderOf.jobAddressLine1, jobAddressLine2: changeOrderOf.jobAddressLine2, jobCity: changeOrderOf.jobCity, jobState: changeOrderOf.jobState, jobPostalCode: changeOrderOf.jobPostalCode,
          notes: null,
          terms: changeOrderOf.terms,
          internalNotes: null,
          discountType: null,
          discountValue: null,
          taxRate: changeOrderOf.taxRate,
          taxLabel: changeOrderOf.taxLabel,
          depositType: null,
          depositValue: null,
          dueDate: null,
          lineItems: [],
          photos: [],
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

  const form = useForm<EstimateFormInput, unknown, EstimateFormValues>({ resolver: zodResolver(isChangeOrder ? changeOrderFormSchema : estimateFormSchema), defaultValues: defaults, mode: "onBlur" });
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

  const submit = handleSubmit(
    (data) => {
      setServerError(null);
      start(async () => {
        const res = estimate ? await updateEstimate(estimate.id, data) : changeOrderOf ? await createChangeOrder(changeOrderOf.id, data) : await createEstimate(data);
        if (!res.ok) return setServerError(res.error);
        router.push(`/estimates/${res.id}`);
      });
    },
    () => setPreview(false), // validation errors live in the form — make sure it's visible
  );

  const previewData = {
    number: numberPreview,
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
    amountPaid: estimate?.amountPaid ?? 0,
    notes: values.notes,
    terms: values.terms,
    kind,
    dueDate: (values.dueDate as Date | null | undefined) ?? null,
    changeOrder: parent ? { parentNumber: parent.number, parentTitle: parent.title, originalTotal: parent.total, priorChangesTotal: parent.priorChangesTotal } : null,
    photos: photos.filter((p) => p.showOnDocument).map((p) => ({ url: p.url, caption: p.caption })),
  };

  const backHref = estimate ? `/estimates/${estimate.id}` : changeOrderOf ? `/estimates/${changeOrderOf.id}` : isInvoice ? "/invoices" : "/estimates";
  const saveLabel = pending ? "Saving…" : estimate ? "Save changes" : `Save ${docWords(kind).word}`;
  const lineCount = lines.fields.length;

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl">
      {/* ── Top bar: back · title · Preview · Save ── */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border flex items-center gap-3">
        <Link href={backHref} className="h-9 w-9 rounded-full grid place-items-center hover:bg-black/5" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{estimate ? `Edit ${Word.toLowerCase()}` : `New ${Word.toLowerCase()}`}</p>
          <p className="text-xs text-muted tabular-nums">{numberPreview} · {money(totals.total)}</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setPreview(true)}><Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span></Button>
        <Button type="submit" variant="accent" disabled={pending}>{saveLabel}</Button>
      </div>
      {serverError && <p className="mb-3 rounded-lg bg-danger-soft text-danger text-sm px-3 py-2">{serverError}</p>}

      <div className="space-y-4">
        {/* ── Header: number, title, dates ── */}
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{numberPreview}</p>
                {isChangeOrder && parent && <p className="text-sm text-muted mt-0.5">Change order for {parent.number}{parent.title ? ` — ${parent.title}` : ""} · original {money(parent.total)}</p>}
              </div>
              <div className="flex gap-2">
                <DateInput control={control} name="issueDate" label="Date" required />
                {isInvoice ? <DateInput control={control} name="dueDate" label="Due date" /> : !isChangeOrder && <DateInput control={control} name="expiresAt" label="Valid until" />}
              </div>
            </div>
            <input {...register("title")} placeholder={isChangeOrder ? "What changed — e.g. Add bathroom exhaust fan" : "Job title — e.g. Exterior repaint, 123 Main St"} className="w-full text-[15px] bg-transparent border-b border-border focus:border-accent focus:outline-none py-1.5 placeholder:text-muted/60" />
          </CardBody>
        </Card>

        {/* ── Client ── */}
        <Card>
          <CardHeader><CardTitle>Client</CardTitle>{isChangeOrder && <span className="text-xs text-muted">From the original estimate</span>}</CardHeader>
          <CardBody>
            <ClientBlock
              client={selectedClient}
              clients={clients}
              locked={isChangeOrder}
              error={errors.clientId?.message}
              onPick={onClientPicked}
              onCreated={(c) => { setClients((p) => [c, ...p]); onClientPicked(c.id); }}
            />
            {!isChangeOrder && (
              <Collapsible title="Job site address (if different from the client's)" defaultOpen={false} className="mt-4">
                <div className="grid grid-cols-6 gap-2">
                  <Input className="col-span-6" placeholder="Street" {...register("jobAddressLine1")} />
                  <Input className="col-span-6" placeholder="Unit / suite (optional)" {...register("jobAddressLine2")} />
                  <Input className="col-span-3" placeholder="City" {...register("jobCity")} />
                  <Input className="col-span-1 uppercase" placeholder="ST" maxLength={2} {...register("jobState")} />
                  <Input className="col-span-2" placeholder="ZIP" {...register("jobPostalCode")} />
                </div>
              </Collapsible>
            )}
          </CardBody>
        </Card>

        {/* ── Items ── */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <span className="text-xs text-muted">{lineCount} item{lineCount === 1 ? "" : "s"}</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {errors.lineItems?.root?.message || (typeof errors.lineItems?.message === "string" && errors.lineItems.message) ? (
              <p className="text-xs text-danger">{errors.lineItems.root?.message ?? errors.lineItems.message}</p>
            ) : null}
            {lines.fields.map((f, i) => (
              <LineRow
                key={f.id}
                index={i}
                count={lineCount}
                control={control}
                register={register}
                onRemove={() => lines.remove(i)}
                onDuplicate={() => { const l = values.lineItems?.[i]; if (l) lines.insert(i + 1, { ...(l as (typeof defaults.lineItems)[number]), serviceItemId: l.serviceItemId ?? null }); }}
                onMove={(dir) => lines.move(i, i + dir)}
                onSaveToCatalog={async () => {
                  const l = values.lineItems?.[i];
                  if (!l?.name) return notify("Give the line a name first");
                  const r = await saveService(null, { name: l.name, description: l.description ?? null, category: null, unit: l.unit ?? "EACH", unitPrice: Number(l.unitPrice) || 0, taxable: !!l.taxable, isMaterial: false });
                  if (r.ok) { setCatalogLocal((c) => [r.item, ...c]); setValue(`lineItems.${i}.serviceItemId`, r.item.id); notify(`"${r.item.name}" saved to your catalog`); } else notify(r.error);
                }}
                lineTotal={totals.lineTotals[i] ?? 0}
                money={money}
                error={errors.lineItems?.[i]}
                allowNegative={isChangeOrder}
              />
            ))}
            <CatalogSearch catalog={catalogLocal} onPick={addFromCatalog} onBlank={addBlank} />
            {lineCount === 0 && (
              <p className="text-xs text-muted text-center">{isChangeOrder ? "Add only what changed — extra work, or a negative rate to credit removed work." : "Search your price book, or add a blank item and type it in."}</p>
            )}
            {lineCount > 0 && <p className="text-[11px] text-muted text-center hidden sm:block">Right-click an item to duplicate, reorder or save it to your price book{isChangeOrder ? " · negative rate = credit" : ""}</p>}
          </CardBody>
        </Card>

        {/* ── Totals ── */}
        <Card>
          <CardBody className="p-0 divide-y divide-border text-sm">
            <TotalRow label="Subtotal" value={money(totals.subtotal)} />

            {!isChangeOrder && (
              <AdjustRow
                label="Discount"
                active={!!values.discountType}
                amount={totals.discountAmount > 0 ? `− ${money(totals.discountAmount)}` : money(0)}
                onAdd={() => setValue("discountType", "PERCENT")}
                onClear={() => { setValue("discountType", null); setValue("discountValue", null); }}
              >
                <Select className="w-20 h-9" {...register("discountType", { setValueAs: (v) => (v === "" ? null : v) })}>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">$</option>
                </Select>
                <Input type="number" inputMode="decimal" step="0.01" min="0" className="w-28 h-9" placeholder="0" {...register("discountValue", { setValueAs: (v) => (v === "" ? null : Number(v)) })} />
              </AdjustRow>
            )}

            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted">{values.taxLabel || "Tax"}</span>
                <Controller
                  control={control}
                  name="taxRate"
                  render={({ field }) => (
                    <div className="relative">
                      {/* Stored as a fraction (0.0825), shown as a percent (8.25) */}
                      <Input
                        type="number" inputMode="decimal" step="0.01" min="0" max="100" aria-label="Tax rate %" className="w-24 h-9 pr-7"
                        value={field.value === undefined || field.value === null || field.value === "" ? "" : String(Math.round(Number(field.value) * 100 * 10000) / 10000)}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value) / 100)}
                        onBlur={field.onBlur}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
                    </div>
                  )}
                />
              </div>
              <span className="tabular-nums">{money(totals.taxAmount)}</span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-base font-semibold">{isChangeOrder ? (totals.total < 0 ? "Credit" : "Change total") : "Total"}</span>
              <span className="text-xl font-semibold tabular-nums">{money(totals.total)}</span>
            </div>

            {!isChangeOrder && !isInvoice && (
              <AdjustRow
                label="Deposit due on acceptance"
                active={!!values.depositType}
                amount={money(totals.depositAmount)}
                onAdd={() => setValue("depositType", "PERCENT")}
                onClear={() => { setValue("depositType", null); setValue("depositValue", null); }}
              >
                <Select className="w-20 h-9" {...register("depositType", { setValueAs: (v) => (v === "" ? null : v) })}>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">$</option>
                </Select>
                <Input type="number" inputMode="decimal" step="0.01" min="0" className="w-28 h-9" placeholder="0" {...register("depositValue", { setValueAs: (v) => (v === "" ? null : Number(v)) })} />
              </AdjustRow>
            )}
            {isChangeOrder && parent && (
              <TotalRow label="Revised contract total" value={money(parent.total + parent.priorChangesTotal + totals.total)} muted />
            )}
          </CardBody>
        </Card>

        {/* ── Notes ── */}
        <Card>
          <CardHeader><CardTitle>Notes to customer</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Textarea {...register("notes")} placeholder="Scope details, what's included, scheduling… Shown at the bottom of the document." />
            <Collapsible title="Terms & conditions" defaultOpen={false}>
              <Textarea {...register("terms")} className="min-h-[120px]" />
            </Collapsible>
            <Collapsible title="Internal notes (never shown to the customer)" defaultOpen={false}>
              <Textarea {...register("internalNotes")} />
            </Collapsible>
          </CardBody>
        </Card>

        {/* ── Photos ── */}
        <Card>
          <CardHeader>
            <CardTitle>Job photos</CardTitle>
            <span className="text-xs text-muted">{photos.length}/20</span>
          </CardHeader>
          <CardBody>
            <PhotoUploader value={photos} onChange={(v) => setValue("photos", v, { shouldDirty: true })} />
          </CardBody>
        </Card>

        {/* ── Template ── */}
        {!isChangeOrder && (
          <Card>
            <CardHeader><CardTitle>Look</CardTitle><Link href="/settings?tab=branding" className="text-xs text-accent hover:underline">Logo & colors</Link></CardHeader>
            <CardBody>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setValue("template", t.id)} className={cn("rounded-lg border-2 p-1 text-left text-xs bg-neutral-100", values.template === t.id ? "border-accent" : "border-transparent hover:border-muted")}>
                    <ScaledDocument className="overflow-hidden rounded bg-white pointer-events-none" width={760} template={t.id} org={docOrg} data={previewData} />
                    <span className={cn("block mt-1 px-1 font-medium", values.template === t.id ? "text-accent" : "text-muted")}>{t.label}</span>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <div className="flex justify-end pt-2 pb-8">
          <Button type="submit" variant="accent" size="lg" disabled={pending}>{saveLabel}</Button>
        </div>
      </div>

      {/* ── Full-size preview ── */}
      {preview && (
        <div className="fixed inset-0 z-40 bg-neutral-100 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setPreview(false)}><Pencil className="h-4 w-4" /> Back to edit</Button>
            <p className="flex-1 text-center text-sm font-medium truncate">{numberPreview} · {money(totals.total)}</p>
            <Button type="submit" variant="accent" disabled={pending}>{saveLabel}</Button>
          </div>
          <div className="mx-auto max-w-3xl px-0 sm:px-4 py-0 sm:py-8 pb-6">
            <div className="bg-white sm:rounded-xl sm:shadow-sm overflow-hidden">
              <EstimateDocument template={(values.template ?? "CLEAN") as Template} org={docOrg} data={previewData} />
            </div>
          </div>
          {!isChangeOrder && (
            <LookPanel org={docOrg} data={previewData} template={(values.template ?? "CLEAN") as Template} onTemplate={(t) => setValue("template", t, { shouldDirty: true })} onColor={setPrimaryColor} />
          )}
        </div>
      )}

      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 rounded-full bg-foreground text-background text-sm px-4 py-2 shadow-lg animate-in-menu">{toast}</div>}
    </form>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

/** Date field through Controller so the <input type=date> always sees "yyyy-mm-dd", never a Date object. */
function DateInput({ control, name, label, required }: { control: Control<EstimateFormInput>; name: "issueDate" | "expiresAt" | "dueDate"; label: string; required?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="block">
          <span className="block text-[11px] font-medium text-muted mb-1">{label}</span>
          <input
            type="date"
            required={required}
            value={toDateInput(field.value as Date | string | null | undefined)}
            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : required ? new Date() : null)}
            onBlur={field.onBlur}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm focus:outline-none focus:border-accent"
          />
        </label>
      )}
    />
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-2.5", muted && "text-muted")}>
      <span className={muted ? "" : "text-muted"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** "+ Add discount" collapsed → inline controls once added, with an × to remove. */
function AdjustRow({ label, active, amount, onAdd, onClear, children }: { label: string; active: boolean; amount: string; onAdd: () => void; onClear: () => void; children: React.ReactNode }) {
  if (!active) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5">
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-accent font-medium hover:underline"><Plus className="h-4 w-4" /> Add {label.toLowerCase()}</button>
        <span className="tabular-nums text-muted">{amount}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span className="text-muted">{label}</span>
        {children}
        <button type="button" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`} className="text-muted hover:text-danger"><X className="h-4 w-4" /></button>
      </div>
      <span className="tabular-nums">{amount}</span>
    </div>
  );
}

function ClientBlock({ client, clients, locked, error, onPick, onCreated }: {
  client: ClientDTO | undefined;
  clients: ClientDTO[];
  locked: boolean;
  error?: string;
  onPick: (id: string) => void;
  onCreated: (c: ClientDTO) => void;
}) {
  const [picking, setPicking] = useState(false);

  if (client && !picking) {
    const contact = [client.phone, client.email].filter(Boolean).join(" · ");
    const addr = [client.addressLine1, [client.city, client.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    return (
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center font-semibold">{client.firstName.charAt(0)}{client.lastName?.charAt(0) ?? ""}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium truncate">{clientDisplayName(client)}</span>
          <span className="block text-xs text-muted truncate">{contact || addr || "No contact info yet"}</span>
          {contact && addr && <span className="block text-xs text-muted truncate">{addr}</span>}
        </span>
        {!locked && <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>Change</Button>}
      </div>
    );
  }

  if (!picking && !client) {
    return (
      <div>
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-accent text-white font-medium hover:bg-accent/90">
          <UserPlus className="h-4 w-4" /> Add client
        </button>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ClientPicker clients={clients} value={client?.id ?? ""} onChange={(id) => { onPick(id); setPicking(false); }} onCreated={(c) => { onCreated(c); setPicking(false); }} />
      {client && <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setPicking(false)}>Cancel</button>}
    </div>
  );
}

function LineRow({ index, count, control, register, onRemove, onDuplicate, onMove, onSaveToCatalog, lineTotal, money, error, allowNegative }: {
  index: number;
  count: number;
  control: Control<EstimateFormInput>;
  register: UseFormRegister<EstimateFormInput>;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onSaveToCatalog: () => void;
  lineTotal: number;
  money: (n: number) => string;
  error?: { name?: { message?: string } };
  allowNegative?: boolean; // change orders: negative rate = credit
}) {
  const [open, setOpen] = useState(false);
  const desc = useWatch({ control, name: `lineItems.${index}.description` });
  const serviceItemId = useWatch({ control, name: `lineItems.${index}.serviceItemId` });
  const menu: MenuItem[] = [
    { type: "label", label: `Item ${index + 1}` },
    { label: "Duplicate item", icon: CopyPlus, onSelect: onDuplicate, hint: "⌘D" },
    { label: "Move up", icon: ArrowUp, onSelect: () => onMove(-1), disabled: index === 0 },
    { label: "Move down", icon: ArrowDown, onSelect: () => onMove(1), disabled: index === count - 1 },
    { type: "separator" },
    { label: serviceItemId ? "Already in price book" : "Save to price book", icon: BookmarkPlus, onSelect: onSaveToCatalog, disabled: !!serviceItemId },
    { label: open || desc ? "Hide description" : "Add description", icon: Pencil, onSelect: () => setOpen((o) => !o) },
    { type: "separator" },
    { label: "Remove item", icon: Trash2, danger: true, onSelect: onRemove },
  ];
  return (
    <ContextMenu
      items={menu}
      className="block rounded-xl border border-border bg-background/60 p-3"
      onKeyDown={(e) => {
        // ⌘D / Ctrl+D duplicates the line you're typing in
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); onDuplicate(); }
      }}
    >
      <div className="flex items-start gap-2">
        <button type="button" className="hidden sm:grid h-9 w-6 place-items-center text-muted/50 hover:text-muted cursor-context-menu" title="Right-click for options" onClick={(e) => e.currentTarget.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: e.clientX, clientY: e.clientY }))}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <Input placeholder="Item name" {...register(`lineItems.${index}.name`)} className={cn("font-medium flex-1", error?.name && "border-danger")} />
            <span className="text-base font-semibold tabular-nums whitespace-nowrap w-28 text-right">{money(lineTotal)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" inputMode="decimal" step="any" min="0" aria-label="Quantity" className="w-24 h-9" {...register(`lineItems.${index}.quantity`)} />
            <Select aria-label="Unit" className="w-24 h-9" {...register(`lineItems.${index}.unit`)}>
              {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <span className="text-muted text-sm">×</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <Input type="number" inputMode="decimal" step="0.01" min={allowNegative ? undefined : "0"} aria-label="Rate" className="pl-7 w-32 h-9" {...register(`lineItems.${index}.unitPrice`)} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted ml-auto">
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" {...register(`lineItems.${index}.taxable`)} /> taxable</label>
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" {...register(`lineItems.${index}.isOptional`)} /> optional</label>
            </div>
          </div>
          {(open || desc) && <Textarea placeholder="Description shown under the item" className="min-h-[56px]" {...register(`lineItems.${index}.description`)} />}
          {!open && !desc && <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setOpen(true)}>+ description</button>}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove item"><Trash2 className="h-4 w-4 text-muted" /></Button>
      </div>
    </ContextMenu>
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
            placeholder="Search your price book…"
            className="pl-9 h-11"
          />
        </div>
        <Button type="button" variant="accent" className="h-11" onClick={onBlank}><Plus className="h-4 w-4" /> Add item</Button>
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
      <Select value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="flex-1 h-11" autoFocus>
        <option value="">Select a client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
      </Select>
      <Button type="button" variant="secondary" className="h-11" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> New</Button>
    </div>
  );
}

function QuickClientForm({ onSubmit, pending, error }: { onSubmit: (d: Record<string, string>) => void; pending: boolean; error: string | null }) {
  const [d, setD] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setD((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="First name *" value={d.firstName ?? ""} onChange={set("firstName")} autoFocus />
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

function Collapsible({ title, defaultOpen, children, className }: { title: string; defaultOpen: boolean; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} /> {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
