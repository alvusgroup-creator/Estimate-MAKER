"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Customer-side response from the public link. No auth — the token is the credential.
 * The contractor keeps the final say (can reopen from the app).
 */
export async function respondToEstimate(
  token: string,
  decision: "ACCEPTED" | "DECLINED",
  input: { signerName?: string; reason?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = await prisma.estimate.findUnique({ where: { publicToken: token }, select: { id: true, status: true, expiresAt: true } });
  if (!e) return { ok: false, error: "This estimate no longer exists." };
  if (e.status !== "SENT" && e.status !== "VIEWED") return { ok: false, error: "This estimate is no longer open for a response." };
  if (decision === "ACCEPTED" && e.expiresAt && e.expiresAt < new Date()) return { ok: false, error: "This estimate has expired. Please ask for an updated one." };

  const signerName = input.signerName?.trim() ?? "";
  if (decision === "ACCEPTED" && signerName.length < 2) return { ok: false, error: "Please type your full name." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await prisma.estimate.update({
    where: { id: e.id },
    data:
      decision === "ACCEPTED"
        ? { status: "ACCEPTED", acceptedAt: new Date(), signerName, signedIp: ip, events: { create: { type: "ACCEPTED", metadata: { by: "customer", signerName, ip } } } }
        : { status: "DECLINED", declinedAt: new Date(), declineReason: input.reason?.trim() || null, events: { create: { type: "DECLINED", metadata: { by: "customer", reason: input.reason?.trim() || null } } } },
  });

  revalidatePath(`/estimates/${e.id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { ok: true };
}
