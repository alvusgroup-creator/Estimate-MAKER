import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Resolves the signed-in user and their organization.
 * Every query in the app must be scoped by the returned `orgId` — this is the tenancy boundary.
 */
export async function requireOrg() {
  const supabase = await createSupabaseServer();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { organization: true },
  });

  // First login → onboarding creates the org
  if (!user) redirect("/onboarding");

  return { user, org: user.organization, orgId: user.organizationId };
}
