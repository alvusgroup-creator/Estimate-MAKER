import { requireOrg } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

// The app always wears the EasyInvoice brand (black + Alvus yellow). The contractor's own
// colors apply to their documents only — see Settings › Branding.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { org, user } = await requireOrg();

  return (
    <div className="min-h-screen md:flex">
      <AppNav orgName={org.name} logoUrl={org.logoUrl} primaryColor={org.primaryColor} userEmail={user.email} userName={user.fullName} plan={org.plan} />
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
