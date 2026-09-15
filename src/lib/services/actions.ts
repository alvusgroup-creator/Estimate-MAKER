"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceItemSchema } from "@/lib/estimates/schemas";
import { toServiceItemDTO, type ServiceItemDTO } from "@/lib/estimates/dto";

export type ServiceResult = { ok: true; item: ServiceItemDTO } | { ok: false; error: string };

type Cleaned = { error: string; data?: never } | { error?: never; data: ServiceData };
type ServiceData = { name: string; description: string | null; category: string | null; unit: ServiceItemDTO["unit"]; unitPrice: number; taxable: boolean; isMaterial: boolean };

function clean(raw: unknown): Cleaned {
  const parsed = serviceItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  return {
    data: {
      name: d.name.trim(),
      description: d.description?.trim() || null,
      category: d.category?.trim() || null,
      unit: d.unit,
      unitPrice: d.unitPrice,
      taxable: d.taxable,
      isMaterial: d.isMaterial,
    },
  };
}

export async function saveService(id: string | null, raw: unknown): Promise<ServiceResult> {
  const { orgId } = await requireOrg();
  const c = clean(raw);
  if (c.error !== undefined) return { ok: false, error: c.error };

  const item = id
    ? await prisma.serviceItem.update({ where: { id, organizationId: orgId }, data: c.data })
    : await prisma.serviceItem.create({ data: { organizationId: orgId, ...c.data } });

  revalidatePath("/services");
  return { ok: true, item: toServiceItemDTO(item) };
}

export async function archiveService(id: string) {
  const { orgId } = await requireOrg();
  await prisma.serviceItem.updateMany({ where: { id, organizationId: orgId }, data: { archivedAt: new Date() } });
  revalidatePath("/services");
}
