"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { GENERAL_CONTRACTOR_PRESETS, DEFAULT_TERMS } from "@/lib/catalog-presets";

const schema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  state: z.string().max(2).optional(),
  taxRatePct: z.coerce.number().min(0).max(30).default(0),
  withPresets: z.string().optional(),
});

export async function createOrganization(formData: FormData) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = schema.parse(Object.fromEntries(formData));

  await prisma.organization.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      state: data.state?.toUpperCase() || null,
      email: user.email,
      defaultTaxRate: data.taxRatePct / 100,
      defaultTerms: DEFAULT_TERMS,
      defaultDepositType: "PERCENT",
      defaultDepositValue: 30,
      users: { create: { id: user.id, email: user.email! } },
      serviceItems: data.withPresets ? { create: GENERAL_CONTRACTOR_PRESETS } : undefined,
    },
  });

  redirect("/dashboard");
}
