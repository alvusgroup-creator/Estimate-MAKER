import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2, Palette, Pencil } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadEstimate } from "@/lib/estimates/queries";
import { toOrgBranding } from "@/lib/estimates/dto";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { EstimateActions } from "@/components/estimates/estimate-actions";
import { AiPanel } from "@/components/estimates/ai-panel";
import { DocumentMenu } from "@/components/estimates/document-menu";
import { PaymentsCard } from "@/components/estimates/payments-card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, docWords } from "@/lib/utils";
import { formatMoney } from "@/lib/estimates/calc";
import { emailEnabled } from "@/lib/email/send";

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
  const { Word } = docWords(estimate.kind);
  const money = (n: number) => formatMoney(n, org.currency, org.locale);
  const approvedChanges = estimate.changeOrders.filter((c) => c.status === "ACCEPTED").reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={estimate.kind === "INVOICE" ? "/invoices" : "/estimates"} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold truncate">{estimate.title ?? estimate.number}</h1>
            <StatusBadge status={estimate.status} />
          </div>
          <p className="text-sm text-muted">
            {Word} {estimate.number}
            {estimate.parent && <> · amends <Link href={`/estimates/${estimate.parent.id}`} className="underline hover:text-foreground">{estimate.parent.number}</Link></>}
            {estimate.viewCount > 0 ? ` · viewed ${estimate.viewCount}×` : ""}
          </p>
        </div>
        {!locked && (
          <Link href={`/estimates/${id}/edit`} className={cn(buttonVariants({ variant: "secondary" }))}><Pencil className="h-4 w-4" /> Edit</Link>
        )}
        {estimate.kind === "ESTIMATE" && estimate.status === "ACCEPTED" && (
          <Link href={`/estimates/${id}/change-order`} className={cn(buttonVariants({ variant: "secondary" }))}><FilePlus2 className="h-4 w-4" /> Change order</Link>
        )}
        <Link href="/settings?tab=branding" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))} aria-label="Customize look (logo, colors, template)" title="Customize look"><Palette className="h-4 w-4" /></Link>
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
              changeOrder: estimate.parent ? { parentNumber: estimate.parent.number, parentTitle: estimate.parent.title, originalTotal: estimate.parent.total, priorChangesTotal: estimate.parent.priorChangesTotal } : null,
            }}
          />
        </div>
        </DocumentMenu>

        <div className="space-y-4">
          <EstimateActions estimate={estimate} publicUrl={publicUrl} emailEnabled={emailEnabled()} />
          {estimate.kind === "INVOICE" && <PaymentsCard invoiceId={estimate.id} total={estimate.total} payments={estimate.payments} currency={org.currency} locale={org.locale} />}
          {estimate.kind === "ESTIMATE" && (estimate.changeOrders.length > 0 || estimate.status === "ACCEPTED") && (
            <Card>
              <CardHeader>
                <CardTitle>Change orders</CardTitle>
                {estimate.status === "ACCEPTED" && <Link href={`/estimates/${id}/change-order`} className="text-xs font-medium text-accent hover:underline">+ New</Link>}
              </CardHeader>
              <CardBody className="p-0">
                {estimate.changeOrders.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">Customer asked for something extra? Add a change order — they approve it separately and it goes on the invoice.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {estimate.changeOrders.map((c) => (
                      <li key={c.id}>
                        <Link href={`/estimates/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-background">
                          <span className="min-w-0 flex-1 truncate">{c.title ?? c.number}<span className="block text-xs text-muted">{c.number}</span></span>
                          <StatusBadge status={c.status} />
                          <span className={cn("tabular-nums font-medium w-20 text-right", c.status !== "ACCEPTED" && "text-muted")}>{money(c.total)}</span>
                        </Link>
                      </li>
                    ))}
                    <li className="flex justify-between px-4 py-2.5 font-medium">
                      <span>Revised total</span>
                      <span className="tabular-nums">{money(estimate.total + approvedChanges)}</span>
                    </li>
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
          <AiPanel estimateId={estimate.id} />
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-border text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="px-4 py-2 flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="capitalize">{ev.type.toLowerCase().replace(/_/g, " ")}</span>
                      {ev.type === "EMAILED" && typeof (ev.metadata as { to?: unknown } | null)?.to === "string" && <span className="text-muted"> · {(ev.metadata as { to: string }).to}</span>}
                    </span>
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
