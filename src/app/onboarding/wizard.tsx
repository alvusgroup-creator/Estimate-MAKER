"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Check, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHELL_PHOTOS, SplitShell } from "@/components/auth/split-shell";
import { ScaledDocument } from "@/components/templates/scaled-document";
import type { OrgBranding } from "@/lib/estimates/dto";
import { TRADES } from "@/lib/trades";
import { cn, daysFromNow } from "@/lib/utils";
import { createOrganization, uploadOnboardingLogo } from "./actions";

type Step = 0 | 1 | 2 | 3; // name → trade → logo → done
const STEPS = 3;

/**
 * Three quick questions, then a "you're in" screen with the contractor's own estimate preview.
 * Everything is optional except the business name; the rest lives in Settings later.
 */
export function OnboardingWizard({ email }: { email: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const back = () => { setError(null); setStep((s) => (s > 0 ? ((s - 1) as Step) : s)); };
  const next = () => { setError(null); setStep((s) => ((s + 1) as Step)); };

  function finish() {
    if (!trade) return;
    start(async () => {
      const r = await createOrganization({ name, trade, logoUrl });
      if (!r.ok) return setError(r.error);
      setStep(3);
    });
  }

  if (step === 3) {
    return (
      <SplitShell photo={<DocumentPreview name={name} logoUrl={logoUrl} email={email} />}>
        <div className="flex-1 flex flex-col items-center justify-start lg:justify-center pt-8 lg:pt-0 text-center">
          <div className="h-24 w-24 rounded-full bg-brand text-brand-foreground grid place-items-center mb-8"><Check className="h-12 w-12" strokeWidth={3} /></div>
          <h1 className="text-3xl font-semibold tracking-tight">Account created!</h1>
          <p className="text-muted mt-2 max-w-sm">Your business is set up. Build your first estimate and send it to a customer in minutes.</p>
        </div>
        <Button size="lg" variant="accent" className="w-full h-14 text-base" onClick={() => router.push("/dashboard")}>Start estimating</Button>
      </SplitShell>
    );
  }

  const photo = [SHELL_PHOTOS.house, SHELL_PHOTOS.blueprint, SHELL_PHOTOS.electrician][step];

  return (
    <SplitShell photo={photo}>
      <div className="flex items-center gap-6">
        <button type="button" onClick={back} disabled={step === 0} aria-label="Back" className="h-10 w-10 rounded-full bg-background grid place-items-center hover:bg-black/5 disabled:opacity-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Progress value={step + 1} max={STEPS} />
      </div>

      <div className="flex-1 flex flex-col justify-start lg:justify-center py-6 lg:py-10 max-w-md w-full mx-auto">
        {step === 0 && (
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) next(); }} className="space-y-6">
            <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight">Business information</h1>
            <div>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Business name"
                  maxLength={200}
                  className="h-12 w-full rounded-lg bg-background pl-10 pr-3 text-[15px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <p className="mt-2 text-sm text-muted">Required. You can change it any time.</p>
            </div>
            <Button type="submit" size="lg" variant="accent" className="w-full h-14 text-base" disabled={!name.trim()}>Continue</Button>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight">Your trade</h1>
              <p className="text-muted mt-1">Pick what you do most. We&apos;ll start your price list with the right services.</p>
            </div>
            <TradePicker value={trade} onChange={setTrade} />
            <Button size="lg" variant="accent" className="w-full h-14 text-base" disabled={!trade} onClick={next}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight">Add your logo</h1>
              <p className="text-muted mt-1 text-sm">Optional — it goes on the top of every estimate. You can add it later in Settings.</p>
            </div>
            <LogoPicker value={logoUrl} onChange={setLogoUrl} onError={setError} />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button size="lg" variant="accent" className="w-full h-14 text-base" disabled={pending} onClick={finish}>{pending ? "Setting up…" : logoUrl ? "Continue" : "Skip for now"}</Button>
          </div>
        )}
      </div>
    </SplitShell>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex-1 max-w-[200px] mx-auto h-1 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

function TradePicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? TRADES.filter((t) => t.label.toLowerCase().includes(s)) : TRADES;
  }, [q]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trades" className="h-11 w-full rounded-lg bg-background pl-10 pr-3 text-sm placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30" />
      </div>
      <ul className="max-h-[42vh] overflow-y-auto space-y-2 pr-1" role="radiogroup">
        {list.map((t) => {
          const on = t.id === value;
          return (
            <li key={t.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(t.id)}
                className={cn("flex w-full items-center justify-between rounded-xl px-4 h-12 text-[15px] transition-colors", on ? "bg-accent-soft text-accent font-medium ring-1 ring-accent/40" : "bg-background hover:bg-black/5")}
              >
                {t.label}
                <span className={cn("h-5 w-5 rounded-full border-2 grid place-items-center", on ? "border-accent bg-accent" : "border-border")}>{on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}</span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="text-sm text-muted text-center py-6">No match — pick &ldquo;General contractor&rdquo; and adjust later.</li>}
      </ul>
    </div>
  );
}

function LogoPicker({ value, onChange, onError }: { value: string | null; onChange: (url: string | null) => void; onError: (e: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    onError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("logo", file);
    const r = await uploadOnboardingLogo(fd);
    setUploading(false);
    if (r.ok) onChange(r.url); else onError(r.error);
  }

  return (
    <div className="rounded-2xl bg-accent-soft/70 h-56 grid place-items-center relative overflow-hidden">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Your logo" className="max-h-32 max-w-[70%] object-contain" />
      ) : null}
      <label className={cn("inline-flex items-center gap-2 rounded-full bg-surface shadow-sm px-5 h-11 text-[15px] font-medium cursor-pointer hover:bg-background", value && "absolute bottom-4", uploading && "opacity-60 pointer-events-none")}>
        <Pencil className="h-4 w-4" /> {uploading ? "Uploading…" : value ? "Change image" : "Choose image"}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
    </div>
  );
}

/** The "done" screen shows a real estimate rendered with the contractor's name and logo, not a stock picture. */
function DocumentPreview({ name, logoUrl, email }: { name: string; logoUrl: string | null; email: string | null }) {
  const org: OrgBranding = {
    name, email, phone: null, website: null, licenseNo: null,
    addressLine1: null, addressLine2: null, city: null, state: null, postalCode: null,
    logoUrl, primaryColor: "#111827", accentColor: "#2563EB", appColor: null, signatureDataUrl: null, signatureName: null, paymentInstructions: null,
    currency: "USD", locale: "en-US",
  };
  const lines = [
    { name: "Demolition & haul-away", description: "Remove existing tile and vanity", quantity: 6, unit: "HOUR" as const, unitPrice: 75, lineTotal: 450 },
    { name: "Drywall install & finish", quantity: 180, unit: "SQFT" as const, unitPrice: 3.25, lineTotal: 585 },
    { name: "Interior painting — walls", description: "Two coats, patch & prep included", quantity: 320, unit: "SQFT" as const, unitPrice: 2.5, lineTotal: 800 },
    { name: "LVP flooring install", quantity: 140, unit: "SQFT" as const, unitPrice: 4.5, lineTotal: 630 },
  ];
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const [issueDate, expiresAt] = useMemo(() => [new Date(), daysFromNow(30)], []);
  return (
    <div className="absolute inset-0 bg-neutral-100 flex items-start lg:items-center justify-center p-4 lg:p-12 overflow-hidden">
      <div className="w-full max-w-[640px]">
        <ScaledDocument
          className="shadow-2xl bg-white"
          template="CLEAN"
          org={org}
          data={{
            number: "EST-1001",
            title: "Hall bathroom remodel",
            issueDate,
            expiresAt,
            client: { id: "", firstName: "Sarah", lastName: "Mitchell", companyName: null, email: "sarah@example.com", phone: "(555) 010-2030", addressLine1: "482 Maple Ave", addressLine2: null, city: "Austin", state: "TX", postalCode: "78704" },
            jobAddress: {},
            lines,
            subtotal,
            discountAmount: 0,
            taxLabel: "Sales Tax",
            taxRate: 0,
            taxAmount: 0,
            total: subtotal,
            depositAmount: Math.round(subtotal * 0.3 * 100) / 100,
            notes: "Work starts within 2 weeks of acceptance. Materials at cost, receipts available.",
            kind: "ESTIMATE",
          }}
        />
      </div>
    </div>
  );
}
