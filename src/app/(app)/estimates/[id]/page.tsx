import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadEstimate } from "@/lib/estimates/queries";
import { toOrgBranding } from "@/lib/estimates/dto";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { EstimateActions } from "@/components/estimates/estimate-actions";
import { AiPanel } from "@/components/estimates/ai-panel";
import { DocumentMenu } from "@/components/estimates/document-menu";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, org } = await requireOrg();
  const [estimate, events] = await Promise.all([
    loadEstimate(orgId, id),
    prisma.estimateEvent.findMany({ where: { estimateId: id, estimate: { organizationId: orgId } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  if (!estimate) notFound();

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/e/${estimate.publicToken}`;
  const locked = estimate.status === "ACCEPTED" || estimate.status === "PAID";
  const inv = estimate.kind === "INVOICE";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/estimates" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate">{estimate.title ?? estimate.number}</h1>
            <StatusBadge status={estimate.status} />
          </div>
          <p className="text-sm text-muted">{inv ? "Invoice" : "Estimate"} {estimate.number}{estimate.viewCount > 0 ? ` · viewed ${estimate.viewCount}×` : ""}</p>
        </div>
        {!locked && (
          <Link href={`/estimates/${id}/edit`} className={cn(buttonVariants({ variant: "secondary" }))}><Pencil className="h-4 w-4" /> Edit</Link>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <DocumentMenu estimate={{ id: estimate.id, number: estimate.number, kind: estimate.kind, status: estimate.status, publicToken: estimate.publicToken, invoiceId: estimate.invoiceId, client: { firstName: estimate.client.firstName, phone: estimate.client.phone, email: estimate.client.email } }}>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-white">
          <EstimateDocument
            template={estimate.template}
            org={toOrgBranding(org)}
            data={{
              ...estimate,
              jobAddress: { addressLine1: estimate.jobAddressLine1, addressLine2: estimate.jobAddressLine2, city: estimate.jobCity, state: estimate.jobState, postalCode: estimate.jobPostalCode },
              lines: estimate.lineItems,
              photos: estimate.photos.filter((p) => p.showOnDocument),
            }}
          />
        </div>
        </DocumentMenu>

        <div className="space-y-4">
          <EstimateActions estimate={estimate} publicUrl={publicUrl} />
          <AiPanel estimateId={estimate.id} />
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-border text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="px-4 py-2 flex justify-between gap-3">
                    <span className="capitalize">{ev.type.toLowerCase().replace("_", " ")}</span>
                    <time className="text-muted text-xs whitespace-nowrap">{ev.createdAt.toLocaleString(org.locale, { dateStyle: "medium", timeStyle: "short" })}</time>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
