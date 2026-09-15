"use client";

import { useActionState, useState } from "react";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { removeLogo, saveBranding, saveBusiness, saveDefaults, uploadLogo, type SettingsState } from "@/lib/settings/actions";
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
  const [appColor, setAppColor] = useState(org.appColor ?? "");
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
              <div className="grid grid-cols-2 gap-3">
                <ColorField name="primaryColor" label="Document primary" value={primary} onChange={setPrimary} hint="Headings, totals, table header" />
                <ColorField name="accentColor" label="Document accent" value={accent} onChange={setAccent} hint="Highlights" />
              </div>
              <Field label="App color" hint="Tints the app itself — sidebar, buttons, active tabs. Leave empty for the default dark theme.">
                <div className="flex items-center gap-2">
                  <input type="color" value={appColor || "#111827"} onChange={(e) => setAppColor(e.target.value)} className="h-10 w-12 rounded-lg border border-border bg-surface p-1 cursor-pointer" aria-label="App color picker" />
                  <Input name="appColor" value={appColor} onChange={(e) => setAppColor(e.target.value)} className="font-mono uppercase" maxLength={7} placeholder="Default" />
                  {appColor && <Button type="button" variant="ghost" size="sm" onClick={() => setAppColor("")}>Reset</Button>}
                </div>
              </Field>
              <Field label="Default template">
                <div className="grid grid-cols-3 gap-2">
                  {(["CLEAN", "BOLD", "CLASSIC"] as Template[]).map((t) => (
                    <label key={t} className={cn("cursor-pointer rounded-lg border-2 p-3 text-center text-sm capitalize", template === t ? "border-accent bg-accent-soft font-medium" : "border-border")}>
                      <input type="radio" name="defaultTemplate" value={t} checked={template === t} onChange={() => setTemplate(t)} className="sr-only" />
                      {t.toLowerCase()}
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
        <div className="rounded-xl border border-border overflow-hidden shadow-sm origin-top">
          <EstimateDocument template={template} org={{ ...org, primaryColor: primary, accentColor: accent }} data={sample} />
        </div>
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
          <SaveRow state={state} pending={pending} />
        </form>
      </CardBody>
    </Card>
  );
}
