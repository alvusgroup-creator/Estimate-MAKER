import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toServiceItemDTO } from "@/lib/estimates/dto";
import { ServicesManager } from "@/components/services/services-manager";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [{ orgId, org }, { new: startNew }] = await Promise.all([requireOrg(), searchParams]);
  const items = await prisma.serviceItem.findMany({
    where: { organizationId: orgId, archivedAt: null },
    orderBy: [{ category: "asc" }, { usageCount: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="text-sm text-muted">Your price book. Tap any item to edit — changes apply to new estimates only.</p>
      </div>
      <ServicesManager initial={items.map(toServiceItemDTO)} currency={org.currency} locale={org.locale} startNew={startNew === "1"} />
    </div>
  );
}
