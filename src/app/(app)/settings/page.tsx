import Link from "next/link";
import { ArrowLeft, Bell, Building2, Check, ChevronRight, Crown, LifeBuoy, LogOut, Palette, PenLine, Percent, X } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { toOrgBranding } from "@/lib/estimates/dto";
import { BrandingForm, BusinessForm, DefaultsForm, NotificationsForm } from "@/components/settings/settings-forms";
import { SignaturePad } from "@/components/settings/signature-pad";
import { logout } from "@/app/(auth)/login/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { emailEnabled } from "@/lib/email/send";
import { tradeById } from "@/lib/trades";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };

const SECTIONS = {
  business: { label: "Business info", sub: "Name, contact, address, license", icon: Building2 },
  branding: { label: "Branding", sub: "Logo, colors, document template", icon: Palette },
  signature: { label: "Your signature", sub: "Stamped on every estimate", icon: PenLine },
  defaults: { label: "Tax & estimate defaults", sub: "Sales tax, validity, deposit, terms", icon: Percent },
  notifications: { label: "Notifications", sub: "When a customer opens or accepts", icon: Bell },
} as const;
type Tab = keyof typeof SECTIONS | "upgrade";

/**
 * Settings is a menu first (like a phone's Settings app) and a form second — every row opens one
 * section with a back arrow. Deep links `?tab=` still work for the rest of the app.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ org, user }, { tab }] = await Promise.all([requireOrg(), searchParams]);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? null;

  const settings = {
    ...toOrgBranding(org),
    defaultTemplate: org.defaultTemplate,
    defaultTaxRate: Number(org.defaultTaxRate),
    taxLabel: org.taxLabel,
    defaultValidDays: org.defaultValidDays,
    defaultDepositType: org.defaultDepositType,
    defaultDepositValue: org.defaultDepositValue == null ? null : Number(org.defaultDepositValue),
    estimatePrefix: org.estimatePrefix,
    defaultNotes: org.defaultNotes,
    defaultTerms: org.defaultTerms,
  };

  if (tab && (tab in SECTIONS || tab === "upgrade")) {
    const t = tab as Tab;
    const title = t === "upgrade" ? "Upgrade to Pro" : SECTIONS[t].label;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/settings" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back to settings"><ArrowLeft className="h-4 w-4" /></Link>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        {t === "business" && <BusinessForm org={settings} />}
        {t === "branding" && <BrandingForm org={settings} />}
        {t === "signature" && <SignaturePad current={org.signatureDataUrl} currentName={org.signatureName} ownerName={user.fullName ?? org.name} />}
        {t === "defaults" && <DefaultsForm org={settings} />}
        {t === "notifications" && <NotificationsForm org={{ notifyEmail: org.notifyEmail, notifyOnViewed: org.notifyOnViewed, notifyOnAccepted: org.notifyOnAccepted, notifyOnDeclined: org.notifyOnDeclined }} loginEmail={user.email} emailEnabled={emailEnabled()} />}
        {t === "upgrade" && <PlanComparison plan={org.plan} />}
      </div>
    );
  }

  const trade = tradeById(org.trade)?.label;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Section title="Account">
        <Row icon={Crown} label={org.plan === "PRO" ? "Pro plan" : "Upgrade to Pro"} sub={org.plan === "PRO" ? "Unlimited estimates, AI review and more" : "See what's included"} href="/settings?tab=upgrade" iconClass="bg-warning-soft text-warning" />
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="h-9 w-9 rounded-lg bg-black/5 text-muted grid place-items-center shrink-0"><LogOut className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium truncate">{user.email}</span>
            <span className="block text-xs text-muted">Signed in</span>
          </span>
          <form action={logout}><Button type="submit" variant="secondary" size="sm">Sign out</Button></form>
        </li>
      </Section>

      <Section title="Business">
        <li className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain bg-white border border-border" />
          ) : (
            <span className="h-10 w-10 rounded-lg grid place-items-center text-white font-bold" style={{ background: org.primaryColor }}>{org.name.charAt(0)}</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold truncate">{org.name}</span>
            <span className="block text-xs text-muted">{trade ?? "Construction"}</span>
          </span>
        </li>
        {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((k) => (
          <Row key={k} icon={SECTIONS[k].icon} label={SECTIONS[k].label} sub={SECTIONS[k].sub} href={`/settings?tab=${k}`} />
        ))}
      </Section>

      {supportEmail && (
        <Section title="Help">
          <Row icon={LifeBuoy} label="Contact support" sub={supportEmail} href={`mailto:${supportEmail}`} iconClass="bg-success-soft text-success" />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 px-1">{title}</p>
      <Card><ul className="divide-y divide-border">{children}</ul></Card>
    </div>
  );
}

function Row({ icon: Icon, label, sub, href, iconClass }: { icon: React.ComponentType<{ className?: string }>; label: string; sub?: string; href: string; iconClass?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
        <span className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", iconClass ?? "bg-accent-soft text-accent")}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {sub && <span className="block text-xs text-muted truncate">{sub}</span>}
        </span>
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}

/** Free vs Pro. Checkout isn't wired yet (Stripe decisions pending) — the page is honest about that. */
function PlanComparison({ plan }: { plan: "FREE" | "PRO" }) {
  const rows: { label: string; sub: string; free: boolean | string; pro: boolean | string }[] = [
    { label: "Estimates & invoices", sub: "Send links your customer accepts and signs from their phone", free: "Up to 3 / month", pro: "Unlimited" },
    { label: "Change orders", sub: "Signed addenda on accepted jobs, folded into the invoice", free: true, pro: true },
    { label: "Your branding", sub: "Logo, colors and three document templates", free: true, pro: true },
    { label: "AI estimate review", sub: "Catches missing lines, weak terms and pricing gaps", free: false, pro: true },
    { label: "Online deposits", sub: "Customer pays the deposit when they accept (coming soon)", free: false, pro: true },
    { label: "Email notifications", sub: "Know the moment a customer opens or accepts", free: true, pro: true },
  ];
  const Mark = ({ v }: { v: boolean | string }) =>
    typeof v === "string" ? <span className="text-xs font-medium">{v}</span> : v ? <span className="h-6 w-6 rounded-full bg-success-soft text-success grid place-items-center"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span> : <span className="h-6 w-6 rounded-full bg-black/5 text-muted grid place-items-center"><X className="h-3.5 w-3.5" /></span>;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="p-0">
          <div className="grid grid-cols-[1fr_84px_84px] items-center px-4 py-3 border-b border-border text-sm">
            <span className="text-muted">What you get</span>
            <span className="text-center font-medium text-muted">Free</span>
            <span className="text-center font-semibold text-accent">Pro</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[1fr_84px_84px] items-center px-4 py-3">
                <span className="min-w-0 pr-3">
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-xs text-muted">{r.sub}</span>
                </span>
                <span className="flex justify-center"><Mark v={r.free} /></span>
                <span className="flex justify-center"><Mark v={r.pro} /></span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="text-center space-y-2">
          {plan === "PRO" ? (
            <p className="text-sm font-medium">You&apos;re on Pro. Thank you!</p>
          ) : (
            <>
              <p className="text-sm font-medium">Pro is coming soon.</p>
              <p className="text-sm text-muted">During early access everything above is free — no limits, no card.</p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
