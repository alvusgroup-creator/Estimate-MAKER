import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toServiceItemDTO } from "@/lib/estimates/dto";
import { ServicesManager } from "@/components/services/services-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Wrench } from "lucide-react";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [{ orgId, org }, { new: startNew }] = await Promise.all([requireOrg(), searchParams]);
  const items = await prisma.serviceItem.findMany({
    where: { organizationId: orgId, archivedAt: null },
    orderBy: [{ category: "asc" }, { usageCount: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <PageHeader icon={Wrench} title="Services" subtitle={`Your price book, ${items.length} item${items.length === 1 ? "" : "s"}. Changes apply to new estimates only.`} />
      <ServicesManager initial={items.map(toServiceItemDTO)} currency={org.currency} locale={org.locale} startNew={startNew === "1"} />
    </div>
  );
}
