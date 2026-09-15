import { prisma } from "@/lib/prisma";
import { toClientDTO, toEstimateDTO, toOrgBranding, toServiceItemDTO } from "./dto";
import type { Organization } from "@/generated/prisma/client";

/** Everything the editor needs, serialized. */
export async function loadEditorData(orgId: string, org: Organization) {
  const [clients, catalog] = await Promise.all([
    prisma.client.findMany({ where: { organizationId: orgId, archivedAt: null }, orderBy: [{ updatedAt: "desc" }], take: 500 }),
    prisma.serviceItem.findMany({ where: { organizationId: orgId, archivedAt: null }, orderBy: [{ usageCount: "desc" }, { name: "asc" }] }),
  ]);

  return {
    org: {
      ...toOrgBranding(org),
      defaultTaxRate: Number(org.defaultTaxRate),
      taxLabel: org.taxLabel,
      defaultTemplate: org.defaultTemplate,
      defaultNotes: org.defaultNotes,
      defaultTerms: org.defaultTerms,
      defaultValidDays: org.defaultValidDays,
      defaultDepositType: org.defaultDepositType,
      defaultDepositValue: org.defaultDepositValue == null ? null : Number(org.defaultDepositValue),
    },
    clients: clients.map(toClientDTO),
    catalog: catalog.map(toServiceItemDTO),
    nextNumberPreview: `${org.estimatePrefix}${org.nextEstimateNumber}`,
  };
}

export async function loadEstimate(orgId: string, id: string) {
  const e = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, include: { client: true, lineItems: true, photos: true, invoice: { select: { id: true } } } });
  return e ? toEstimateDTO(e) : null;
}
