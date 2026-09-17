"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TERMS } from "@/lib/catalog-presets";
import { presetsForTrade, TRADES } from "@/lib/trades";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/** Logo step: the org doesn't exist yet, so the file is parked in storage under the user id and linked on finish. */
export async function uploadOnboardingLogo(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in again." };

  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image first" };
  if (!LOGO_TYPES.includes(file.type)) return { ok: false, error: "Use PNG, JPG, WebP or SVG" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Max 2 MB" };

  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const path = `${user.id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };

  return { ok: true, url: supabase.storage.from("logos").getPublicUrl(path).data.publicUrl };
}

const schema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(200),
  trade: z.enum(TRADES.map((t) => t.id) as [string, ...string[]]),
  logoUrl: z.string().url().nullable().optional(),
});

export type CreateOrgInput = z.input<typeof schema>;

/** Final step. Creates the org + starter catalog for the trade; the wizard then shows "Account created". */
export async function createOrganization(raw: CreateOrgInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  // Refresh or double-submit: the org is already there, just continue
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (existing) return { ok: true };

  await prisma.organization.create({
    data: {
      name: data.name,
      trade: data.trade,
      logoUrl: data.logoUrl ?? null,
      email: user.email,
      defaultTerms: DEFAULT_TERMS,
      defaultDepositType: "PERCENT",
      defaultDepositValue: 30,
      users: { create: { id: user.id, email: user.email! } },
      serviceItems: { create: presetsForTrade(data.trade) },
    },
  });

  return { ok: true };
}
