import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleEstimates } from "@/lib/estimates/expire";
import { formatMoney } from "@/lib/estimates/calc";
import { clientDisplayName, cn } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/card";
import { StatusBadge, statusLabels } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { DocumentKind, EstimateStatus } from "@/generated/prisma/enums";
import { EstimateRowMenu } from "@/components/estimates/estimate-row-menu";
import { DiscoveryHint } from "@/components/ui/discovery-hint";

export const metadata = { title: "Estimates" };

const filters: { key: string; label: string; kind: DocumentKind; statuses?: EstimateStatus[] }[] = [
  { key: "all", label: "All", kind: "ESTIMATE" },
  { key: "open", label: "Open", kind: "ESTIMATE", statuses: ["SENT", "VIEWED"] },
  { key: "draft", label: "Drafts", kind: "ESTIMATE", statuses: ["DRAFT"] },
  { key: "accepted", label: "Accepted", kind: "ESTIMATE", statuses: ["ACCEPTED"] },
  { key: "declined", label: "Declined / expired", kind: "ESTIMATE", statuses: ["DECLINED", "EXPIRED"] },
  { key: "invoices", label: "Invoices", kind: "INVOICE" },
  { key: "unpaid", label: "Unpaid", kind: "INVOICE", statuses: ["DRAFT", "SENT", "VIEWED"] },
  { key: "changes", label: "Change orders", kind: "CHANGE_ORDER" },
];

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { f = "all", q = "" } = await searchParams;
  const { orgId, org } = await requireOrg();
  await expireStaleEstimates(orgId);
  const filter = filters.find((x) => x.key === f) ?? filters[0];

  const estimates = await prisma.estimate.findMany({
    where: {
      organizationId: orgId,
      kind: filter.kind,
      ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { client: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { client: true, invoice: { select: { id: true } } },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{filter.kind === "INVOICE" ? "Invoices" : filter.kind === "CHANGE_ORDER" ? "Change orders" : "Estimates"}</h1>
        <Link href="/estimates/new" className={buttonVariants()}><Plus className="h-4 w-4" /> New</Link>
      </div>

      <form className="flex gap-2">
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={q} placeholder="Search number, title or client…" className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" />
      </form>

      <DiscoveryHint />

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
        {filters.map((x) => (
          <Link
            key={x.key}
            href={`/estimates?f=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("shrink-0 rounded-full px-3 h-8 inline-flex items-center text-sm", x.key === filter.key ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-muted")}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <Card>
        {estimates.length === 0 ? (
          <EmptyState title={q ? "No matches" : filter.kind === "INVOICE" ? "No invoices yet" : filter.kind === "CHANGE_ORDER" ? "No change orders yet" : `No ${filter.key === "all" ? "" : filter.label.toLowerCase() + " "}estimates`} description={q ? "Try a different search." : filter.kind === "INVOICE" ? "Accept an estimate, then use “Convert to invoice”." : filter.kind === "CHANGE_ORDER" ? "Open an accepted estimate and click “Change order” when the customer asks for extra work." : undefined} />
        ) : (
          <ul className="divide-y divide-border">
            {estimates.map((e) => (
              <EstimateRowMenu as="li" key={e.id} estimate={{ id: e.id, number: e.number, kind: e.kind, status: e.status, publicToken: e.publicToken, invoiceId: e.invoice?.id ?? null, client: { firstName: e.client.firstName, phone: e.client.phone, email: e.client.email } }}>
                <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title ?? e.number}</p>
                    <p className="text-xs text-muted truncate">{e.number} · {clientDisplayName(e.client)} · {e.updatedAt.toLocaleDateString(org.locale, { month: "short", day: "numeric" })}</p>
                  </div>
                  <StatusBadge status={e.status} className="hidden sm:inline-flex" />
                  <span className="sm:hidden text-[10px] text-muted">{statusLabels[e.status]}</span>
                  <span className="text-sm font-medium tabular-nums w-24 text-right">{formatMoney(Number(e.total), org.currency, org.locale)}</span>
                </Link>
              </EstimateRowMenu>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
