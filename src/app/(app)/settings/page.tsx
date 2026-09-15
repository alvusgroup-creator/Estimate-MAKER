import { requireOrg } from "@/lib/auth";
import { toOrgBranding } from "@/lib/estimates/dto";
import { BrandingForm, BusinessForm, DefaultsForm } from "@/components/settings/settings-forms";
import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ org, user }, { tab = "business" }] = await Promise.all([requireOrg(), searchParams]);

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

  const tabs = [
    { key: "business", label: "Business" },
    { key: "branding", label: "Branding" },
    { key: "defaults", label: "Estimate defaults" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
        {tabs.map((t) => (
          <a key={t.key} href={`/settings?tab=${t.key}`} className={`shrink-0 rounded-full px-3 h-8 inline-flex items-center text-sm ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-muted"}`}>
            {t.label}
          </a>
        ))}
      </div>

      {tab === "branding" ? <BrandingForm org={settings} /> : tab === "defaults" ? <DefaultsForm org={settings} /> : (
        <>
          <BusinessForm org={settings} />
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <span className="text-muted truncate">Signed in as {user.email}</span>
            <form action={logout}><Button type="submit" variant="ghost" size="sm">Sign out</Button></form>
          </div>
        </>
      )}
    </div>
  );
}
