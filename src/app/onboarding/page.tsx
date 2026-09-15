import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createOrganization } from "./actions";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (existing) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Set up your business</h1>
          <p className="text-sm text-muted mt-1">This goes on the top of every estimate. You can change it any time.</p>
        </div>
        <Card>
          <CardBody className="p-6">
            <form action={createOrganization} className="space-y-4">
              <Field label="Business name">
                <Input name="name" required placeholder="Rodriguez Home Services LLC" autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input name="phone" type="tel" inputMode="tel" placeholder="(555) 010-2030" />
                </Field>
                <Field label="State">
                  <Input name="state" maxLength={2} placeholder="TX" className="uppercase" />
                </Field>
              </div>
              <Field label="Sales tax rate (%)" hint="Applied to taxable lines by default. Leave 0 if you don't charge tax.">
                <Input name="taxRatePct" type="number" inputMode="decimal" step="0.01" min="0" max="30" defaultValue="0" />
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="withPresets" defaultChecked className="mt-1" />
                <span>
                  Start with a catalog of common services
                  <span className="block text-xs text-muted">25 typical items (painting, drywall, flooring, exterior…) with placeholder prices you edit.</span>
                </span>
              </label>
              <Button type="submit" size="lg" className="w-full">Continue</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
