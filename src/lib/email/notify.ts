import { prisma } from "@/lib/prisma";
import { clientDisplayName } from "@/lib/utils";
import { sendEmail } from "./send";
import { contractorActivityEmail } from "./templates";

/**
 * Email the contractor about customer activity on the public link.
 * Never throws — it runs inside `after()` and a failed email must not affect the customer's request.
 */
export async function notifyContractor(
  estimateId: string,
  kind: "VIEWED" | "ACCEPTED" | "DECLINED",
  extra?: { signerName?: string | null; reason?: string | null },
) {
  try {
    const e = await prisma.estimate.findUnique({
      where: { id: estimateId },
      select: {
        id: true, number: true, kind: true, title: true, total: true, currency: true, publicToken: true,
        client: { select: { firstName: true, lastName: true, companyName: true } },
        organization: {
          select: {
            notifyEmail: true, notifyOnViewed: true, notifyOnAccepted: true, notifyOnDeclined: true, locale: true, primaryColor: true,
            users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
          },
        },
      },
    });
    if (!e) return;
    const o = e.organization;
    const wanted = kind === "VIEWED" ? o.notifyOnViewed : kind === "ACCEPTED" ? o.notifyOnAccepted : o.notifyOnDeclined;
    if (!wanted) return;
    const to = o.notifyEmail ?? o.users[0]?.email;
    if (!to) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const mail = contractorActivityEmail({
      kind,
      doc: { number: e.number, kind: e.kind, title: e.title, total: Number(e.total), currency: e.currency, locale: o.locale, publicUrl: `${appUrl}/e/${e.publicToken}` },
      clientName: clientDisplayName(e.client),
      appUrl,
      estimateId: e.id,
      signerName: extra?.signerName,
      reason: extra?.reason,
      color: o.primaryColor,
    });
    const r = await sendEmail({ to, ...mail });
    if (!r.ok) console.error(`[email] notify ${kind} failed for ${e.number}: ${r.error}`);
  } catch (err) {
    console.error("[email] notifyContractor failed", err);
  }
}
