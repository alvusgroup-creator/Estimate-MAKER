"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabase/server";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563EB");
const opt = (max = 200) => z.string().max(max).transform((s) => s.trim() || null).nullable().optional();

const businessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(200),
  email: opt(),
  phone: opt(30),
  website: opt(),
  licenseNo: opt(60),
  addressLine1: opt(),
  addressLine2: opt(),
  city: opt(100),
  state: opt(2),
  postalCode: opt(10),
});

const brandingSchema = z.object({
  primaryColor: hex,
  accentColor: hex,
  defaultTemplate: z.enum(["CLEAN", "BOLD", "CLASSIC"]),
});

const defaultsSchema = z.object({
  taxRatePct: z.coerce.number().min(0).max(30),
  taxLabel: z.string().min(1).max(40),
  defaultValidDays: z.coerce.number().int().min(1).max(365),
  defaultDepositType: z.enum(["PERCENT", "FIXED", ""]).transform((v) => (v === "" ? null : v)),
  defaultDepositValue: z.union([z.literal(""), z.coerce.number().min(0)]).transform((v) => (v === "" ? null : v)),
  estimatePrefix: z.string().max(10),
  defaultNotes: z.string().max(5000).transform((s) => s.trim() || null),
  defaultTerms: z.string().max(5000).transform((s) => s.trim() || null),
});

export type SettingsState = { ok?: boolean; error?: string } | undefined;

export async function saveBusiness(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const { orgId } = await requireOrg();
  const p = businessSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  await prisma.organization.update({ where: { id: orgId }, data: { ...p.data, state: p.data.state?.toUpperCase() ?? null } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBranding(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const { orgId } = await requireOrg();
  const p = brandingSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  await prisma.organization.update({ where: { id: orgId }, data: p.data });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveDefaults(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const { orgId } = await requireOrg();
  const p = defaultsSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const { taxRatePct, ...rest } = p.data;
  await prisma.organization.update({ where: { id: orgId }, data: { ...rest, defaultTaxRate: taxRatePct / 100 } });
  revalidatePath("/settings");
  return { ok: true };
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function uploadLogo(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const { orgId, user } = await requireOrg();
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first" };
  if (!LOGO_TYPES.includes(file.type)) return { error: "Use PNG, JPG, WebP or SVG" };
  if (file.size > 2 * 1024 * 1024) return { error: "Max 2 MB" };

  const supabase = await createSupabaseServer();
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  // Path is prefixed by the auth user id — matches the storage RLS policy
  const path = `${user.id}/logo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: `Upload failed: ${error.message}` };

  const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
  await prisma.organization.update({ where: { id: orgId }, data: { logoUrl: publicUrl } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeLogo() {
  const { orgId } = await requireOrg();
  await prisma.organization.update({ where: { id: orgId }, data: { logoUrl: null } });
  revalidatePath("/", "layout");
}
