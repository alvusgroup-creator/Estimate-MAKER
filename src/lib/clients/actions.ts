"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/estimates/schemas";
import { toClientDTO, type ClientDTO } from "@/lib/estimates/dto";

export type ClientResult = { ok: true; client: ClientDTO } | { ok: false; error: string };

type Normalized = { error: string; data?: never } | { data: NonNullable<ReturnType<typeof buildClientData>>; error?: never };

function normalize(raw: unknown): Normalized {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  return { data: buildClientData(parsed.data) };
}

function buildClientData(d: import("zod").infer<typeof clientSchema>) {
  return {
      firstName: d.firstName.trim(),
      lastName: d.lastName?.trim() || null,
      companyName: d.companyName?.trim() || null,
      email: d.email?.trim() || null,
      phone: d.phone?.trim() || null,
      addressLine1: d.addressLine1?.trim() || null,
      addressLine2: d.addressLine2?.trim() || null,
      city: d.city?.trim() || null,
      state: d.state?.trim().toUpperCase() || null,
      postalCode: d.postalCode?.trim() || null,
      notes: d.notes?.trim() || null,
      tags: d.tags,
  };
}

/** Used inline from the estimate editor — returns the DTO instead of redirecting. */
export async function createClientQuick(raw: unknown): Promise<ClientResult> {
  const { orgId } = await requireOrg();
  const n = normalize(raw);
  if (n.error !== undefined) return { ok: false, error: n.error };
  const client = await prisma.client.create({ data: { organizationId: orgId, ...n.data } });
  revalidatePath("/clients");
  return { ok: true, client: toClientDTO(client) };
}

export async function createClient(formData: FormData) {
  const { orgId } = await requireOrg();
  const n = normalize(Object.fromEntries(formData));
  if (n.error !== undefined) throw new Error(n.error);
  const client = await prisma.client.create({ data: { organizationId: orgId, ...n.data } });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, formData: FormData) {
  const { orgId } = await requireOrg();
  const n = normalize(Object.fromEntries(formData));
  if (n.error !== undefined) throw new Error(n.error);
  await prisma.client.updateMany({ where: { id, organizationId: orgId }, data: n.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function archiveClient(id: string) {
  const { orgId } = await requireOrg();
  await prisma.client.updateMany({ where: { id, organizationId: orgId }, data: { archivedAt: new Date() } });
  revalidatePath("/clients");
  redirect("/clients");
}
