"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { notifyContractor } from "@/lib/email/notify";
import { signatureDataUrlSchema } from "@/lib/estimates/schemas";

/**
 * Customer-side response from the public link. No auth — the token is the credential.
 * The contractor keeps the final say (can reopen from the app).
 */
export async function respondToEstimate(
  token: string,
  decision: "ACCEPTED" | "DECLINED",
  input: { signerName?: string; signatureDataUrl?: string | null; reason?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers();
  const ip = clientIp(h);
  // 5 responses per IP per 10 min, and 3 per estimate per 10 min regardless of IP
  if (!rateLimit(`respond:ip:${ip}`, 5, 600_000) || !rateLimit(`respond:tok:${token}`, 3, 600_000)) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const e = await prisma.estimate.findUnique({ where: { publicToken: token }, select: { id: true, status: true, expiresAt: true, kind: true } });
  if (!e) return { ok: false, error: "This estimate no longer exists." };
  if (e.status !== "SENT" && e.status !== "VIEWED") return { ok: false, error: "This estimate is no longer open for a response." };
  if (decision === "ACCEPTED" && e.expiresAt && e.expiresAt < new Date()) return { ok: false, error: "This estimate has expired. Please ask for an updated one." };

  const signerName = input.signerName?.trim() ?? "";
  if (decision === "ACCEPTED" && signerName.length < 2) return { ok: false, error: "Please type your full name." };

  // Drawn signature is optional; the typed name is the legal record either way
  let signatureDataUrl: string | null = null;
  if (decision === "ACCEPTED" && input.signatureDataUrl) {
    const sig = signatureDataUrlSchema.safeParse(input.signatureDataUrl);
    if (!sig.success) return { ok: false, error: sig.error.issues[0].message };
    signatureDataUrl = sig.data;
  }

  if (e.kind !== "ESTIMATE") return { ok: false, error: "Invoices cannot be accepted here." };

  await prisma.estimate.update({
    where: { id: e.id },
    data:
      decision === "ACCEPTED"
        ? { status: "ACCEPTED", acceptedAt: new Date(), signerName, signatureDataUrl, signedIp: ip, events: { create: { type: "ACCEPTED", metadata: { by: "customer", signerName, drawn: !!signatureDataUrl, ip } } } }
        : { status: "DECLINED", declinedAt: new Date(), declineReason: input.reason?.trim() || null, events: { create: { type: "DECLINED", metadata: { by: "customer", reason: input.reason?.trim() || null } } } },
  });

  // Email the contractor once the customer's response has been sent back
  after(() => notifyContractor(e.id, decision, { signerName, reason: input.reason?.trim() || null }));

  revalidatePath(`/estimates/${e.id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { ok: true };
}
