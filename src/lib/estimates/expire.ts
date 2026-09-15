import { prisma } from "@/lib/prisma";

/**
 * Flip open estimates past their validity date to EXPIRED.
 * Called lazily from the pages that list/show estimates (no cron needed on the MVP);
 * cheap because of the (status, expiresAt) index. Pass orgId to scope, omit for a global sweep.
 */
export async function expireStaleEstimates(orgId?: string) {
  const stale = await prisma.estimate.findMany({
    where: { kind: "ESTIMATE", status: { in: ["SENT", "VIEWED"] }, expiresAt: { lt: new Date() }, ...(orgId ? { organizationId: orgId } : {}) },
    select: { id: true },
    take: 200,
  });
  if (stale.length === 0) return 0;

  const ids = stale.map((s) => s.id);
  await prisma.$transaction([
    prisma.estimate.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } }),
    prisma.estimateEvent.createMany({ data: ids.map((id) => ({ estimateId: id, type: "EXPIRED" as const })) }),
  ]);
  return ids.length;
}
