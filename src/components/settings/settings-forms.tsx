"use client";

import { useActionState, useState } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ScaledDocument } from "@/components/templates/scaled-document";
import { PALETTE, TEMPLATES } from "@/lib/templates";
import { removeLogo, saveBranding, saveBusiness, saveDefaults, saveNotifications, uploadLogo, type SettingsState } from "@/lib/settings/actions";
import type { OrgBranding } from "@/lib/estimates/dto";
import type { Template } from "@/generated/prisma/enums";
import { cn, daysFromNow } from "@/lib/utils";

type OrgSettings = OrgBranding & {
  defaultTemplate: Template;
  defaultTaxRate: number;
  taxLabel: string;
  defaultValidDays: number;
  defaultDepositType: "PERCENT" | "FIXED" | null;
  defaultDepositValue: number | null;
  estimatePrefix: string;
  defaultNotes: string | null;
  defaultTerms: string | null;
  paymentInstructions: string | null;
};

function SaveRow({ state, pending, label = "Save" }: { state: SettingsState; pending: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : label}</Button>
      {state?.ok && <span className="text-sm text-success inline-flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
      {state?.error && <span className="text-sm text-danger">{state.error}</span>}
    </div>
  );
}

export function BusinessForm({ org }: { org: OrgSettings }) {
  const [state, action, pending] = useActionState(saveBusiness, undefined);
  return (
    <Card>
      <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
      <CardBody>
        <form action={action} className="space-y-4">
          <Field label="Business name *"><Input name="name" required defaultValue={org.name} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input name="phone" type="tel" defaultValue={org.phone ?? ""} /></Field>
            <Field label="Email"><Input name="email" type="email" defaultValue={org.email ?? ""} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website"><Input name="website" defaultValue={org.website ?? ""} placeholder="yourcompany.com" /></Field>
            <Field label="License / EIN" hint="Shown in the estimate footer"><Input name="licenseNo" defaultValue={org.licenseNo ?? ""} placeholder="CSLB #1092233" /></Field>
          </div>
          <Field label="Address">
            <div className="space-y-2">
              <Input name="addressLine1" placeholder="Street" defaultValue={org.addressLine1 ?? ""} />
              <Input name="addressLine2" placeholder="Suite (optional)" defaultValue={org.addressLine2 ?? ""} />
              <div className="grid grid-cols-6 gap-2">
                <Input name="city" className="col-span-3" placeholder="City" defaultValue={org.city ?? ""} />
                <Input name="state" className="col-span-1 uppercase" placeholder="ST" maxLength={2} defaultValue={org.state ?? ""} />
                <Input name="postalCode" className="col-span-2" placeholder="ZIP" defaultValue={org.postalCode ?? ""} />
              </div>
            </div>
          </Field>
          <SaveRow state={state} pending={pending} />
        </form>
      </CardBody>
    </Card>
  );
}

export function BrandingForm({ org }: { org: OrgSettings }) {
  const [state, action, pending] = useActionState(saveBranding, undefined);
  const [logoState, logoAction, logoPending] = useActionState(uploadLogo, undefined);
  const [primary, setPrimary] = useState(org.primaryColor);
  const [accent, setAccent] = useState(org.accentColor);
  const [template, setTemplate] = useState<Template>(org.defaultTemplate);

  const sample = {
    number: "EST-1042",
    title: "Sample estimate",
    issueDate: new Date(),
    expiresAt: daysFromNow(30),
    client: { id: "", firstName: "Jordan", lastName: "Lee", companyName: null, email: null, phone: "(555) 010-9988", addressLine1: "88 Pecan Ln", addressLine2: null, city: org.city ?? "Austin", state: org.state ?? "TX", postalCode: "78745" },
    jobAddress: {},
    lines: [
      { name: "Site Prep & Protection", quantity: 1, unit: "FLAT" as const, unitPrice: 150, lineTotal: 150 },
      { name: "Interior Painting — Walls", description: "Two coats premium paint", quantity: 1200, unit: "SQFT" as const, unitPrice: 2.5, lineTotal: 3000 },
    ],
    subtotal: 3150, discountAmount: 0, taxLabel: org.taxLabel, taxRate: org.defaultTaxRate, taxAmount: Math.round(3150 * org.defaultTaxRate * 100) / 100,
    total: Math.round(3150 * (1 + org.defaultTaxRate) * 100) / 100, depositAmount: 0,
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
          <CardBody>
            <form action={logoAction} className="flex flex-wrap items-center gap-4">
              <div className="h-20 w-20 rounded-lg border border-border bg-white grid place-items-center overflow-hidden">
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-bold text-white h-full w-full grid place-items-center" style={{ background: primary }}>{org.name.charAt(0)}</span>
                )}
              </div>
              <div className="space-y-2">
                <label className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-background", logoPending && "opacity-50 pointer-events-none")}>
                  <Upload className="h-4 w-4" /> {logoPending ? "Uploading…" : "Choose image"}
                  <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.form?.requestSubmit()} />
                </label>
                <p className="text-xs text-muted">PNG, JPG, WebP or SVG · max 2 MB · transparent background looks best</p>
                {logoState?.error && <p className="text-xs text-danger">{logoState.error}</p>}
                {org.logoUrl && <button type="button" formNoValidate className="text-xs text-danger" onClick={() => removeLogo()}>Remove logo</button>}
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Colors & template</CardTitle></CardHeader>
          <CardBody>
            <form action={action} className="space-y-4">
              <Field label="Quick palette" hint="Tap a color for headings and totals; fine-tune below.">
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => (
                    <button key={c} type="button" aria-label={c} onClick={() => setPrimary(c)} className={cn("h-8 w-8 rounded-full border-2 transition-transform hover:scale-110", primary.toLowerCase() === c ? "border-foreground scale-110" : "border-transparent")} style={{ background: c }} />
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <ColorField name="primaryColor" label="Document primary" value={primary} onChange={setPrimary} hint="Headings, totals, table header" />
                <ColorField name="accentColor" label="Document accent" value={accent} onChange={setAccent} hint="Highlights" />
              </div>
              <Field label="Default template">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEMPLATES.map((t) => (
                    <label key={t.id} className={cn("cursor-pointer rounded-lg border-2 p-3 text-sm", template === t.id ? "border-accent bg-accent-soft" : "border-border hover:border-muted")}>
                      <input type="radio" name="defaultTemplate" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" />
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-xs text-muted">{t.description}</span>
                    </label>
                  ))}
                </div>
              </Field>
              <SaveRow state={state} pending={pending} />
            </form>
          </CardBody>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <p className="text-xs font-medium text-muted mb-2 px-1">Live preview</p>
        <ScaledDocument className="rounded-xl border border-border overflow-hidden shadow-sm bg-white" template={template} org={{ ...org, primaryColor: primary, accentColor: accent }} data={sample} />
      </div>
    </div>
  );
}

function ColorField({ name, label, value, onChange, hint }: { name: string; label: string; value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-surface p-1 cursor-pointer" aria-label={`${label} picker`} />
        <Input name={name} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
      </div>
    </Field>
  );
}

export function DefaultsForm({ org }: { org: OrgSettings }) {
  const [state, action, pending] = useActionState(saveDefaults, undefined);
  return (
    <Card>
      <CardHeader><CardTitle>Estimate defaults</CardTitle></CardHeader>
      <CardBody>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Tax rate (%)"><Input name="taxRatePct" type="number" inputMode="decimal" step="0.01" min="0" max="30" defaultValue={(org.defaultTaxRate * 100).toString()} /></Field>
            <Field label="Tax label"><Input name="taxLabel" defaultValue={org.taxLabel} /></Field>
            <Field label="Valid for (days)"><Input name="defaultValidDays" type="number" min="1" max="365" defaultValue={org.defaultValidDays} /></Field>
            <Field label="Number prefix"><Input name="estimatePrefix" defaultValue={org.estimatePrefix} placeholder="EST-" /></Field>
          </div>
          <Field label="Default deposit">
            <div className="flex gap-2 max-w-xs">
              <Select name="defaultDepositType" defaultValue={org.defaultDepositType ?? ""} className="w-28">
                <option value="">None</option>
                <option value="PERCENT">%</option>
                <option value="FIXED">$</option>
              </Select>
              <Input name="defaultDepositValue" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={org.defaultDepositValue ?? ""} />
            </div>
          </Field>
          <Field label="Default notes to customer"><Textarea name="defaultNotes" defaultValue={org.defaultNotes ?? ""} /></Field>
          <Field label="Default terms"><Textarea name="defaultTerms" defaultValue={org.defaultTerms ?? ""} className="min-h-[140px]" /></Field>
          <Field label="Payment instructions (shown on invoices)" hint="How customers pay you: check payable to, Zelle, bank/routing, card link.">
            <Textarea name="paymentInstructions" defaultValue={org.paymentInstructions ?? ""} placeholder={"Zelle: (555) 010-2030\nChecks payable to Rodriguez Home Services LLC"} />
          </Field>
          <SaveRow state={state} pending={pending} />
        </form>
      </CardBody>
    </Card>
  );
}

export function NotificationsForm({ org, loginEmail, emailEnabled }: {
  org: { notifyEmail: string | null; notifyOnViewed: boolean; notifyOnAccepted: boolean; notifyOnDeclined: boolean };
  loginEmail: string;
  emailEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(saveNotifications, undefined);
  const rows = [
    { name: "notifyOnViewed", label: "Customer opened the estimate", hint: "Only the first time — a good moment to follow up.", on: org.notifyOnViewed },
    { name: "notifyOnAccepted", label: "Customer accepted", hint: "Includes who signed and the total.", on: org.notifyOnAccepted },
    { name: "notifyOnDeclined", label: "Customer declined", hint: "Includes their reason, if they gave one.", on: org.notifyOnDeclined },
  ];
  return (
    <Card>
      <CardHeader><CardTitle>Email notifications</CardTitle></CardHeader>
      <CardBody>
        {!emailEnabled && (
          <p className="mb-4 rounded-lg bg-amber-100 text-amber-900 text-sm px-3 py-2">Email sending isn&apos;t configured on this server yet (missing <code>RESEND_API_KEY</code>). Your preferences are saved and will apply once it is.</p>
        )}
        <form action={action} className="space-y-4">
          <Field label="Send notifications to" hint={`Leave blank to use your login email (${loginEmail}).`}>
            <Input name="notifyEmail" type="email" defaultValue={org.notifyEmail ?? ""} placeholder={loginEmail} />
          </Field>
          <div className="space-y-2">
            {rows.map((r) => (
              <label key={r.name} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-background">
                <input type="checkbox" name={r.name} defaultChecked={r.on} className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="text-sm"><span className="font-medium">{r.label}</span><span className="block text-xs text-muted">{r.hint}</span></span>
              </label>
            ))}
          </div>
          <SaveRow state={state} pending={pending} />
        </form>
      </CardBody>
    </Card>
  );
}
