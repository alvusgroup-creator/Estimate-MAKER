import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (existing) redirect("/dashboard");

  return <OnboardingWizard email={user.email ?? null} />;
}
