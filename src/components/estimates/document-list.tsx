import Link from "next/link";
import { ChevronLeft, ChevronRight, FilePlus2, FileText, Plus, Receipt } from "lucide-react";
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

export type ListFilter = { key: string; label: string; kind: DocumentKind; statuses?: EstimateStatus[] };

export const ESTIMATE_FILTERS: ListFilter[] = [
  { key: "all", label: "All", kind: "ESTIMATE" },
  { key: "open", label: "Open", kind: "ESTIMATE", statuses: ["SENT", "VIEWED"] },
  { key: "draft", label: "Drafts", kind: "ESTIMATE", statuses: ["DRAFT"] },
  { key: "accepted", label: "Accepted", kind: "ESTIMATE", statuses: ["ACCEPTED"] },
  { key: "declined", label: "Declined / expired", kind: "ESTIMATE", statuses: ["DECLINED", "EXPIRED"] },
  { key: "changes", label: "Change orders", kind: "CHANGE_ORDER" },
];

export const INVOICE_FILTERS: ListFilter[] = [
  { key: "all", label: "All", kind: "INVOICE" },
  { key: "unpaid", label: "Unpaid", kind: "INVOICE", statuses: ["DRAFT", "SENT", "VIEWED"] },
  { key: "paid", label: "Paid", kind: "INVOICE", statuses: ["PAID"] },
];

/** "2026-09" → [start, end) of that month; anything unparsable → current month. */
function monthRange(m: string | undefined) {
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const y = match ? Number(match[1]) : now.getFullYear();
  const mo = match ? Number(match[2]) - 1 : now.getMonth();
  return { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 1), key: `${y}-${String(mo + 1).padStart(2, "0")}` };
}
const shiftMonth = (key: string, by: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Estimates and invoices share one list: month header with the period's total, search,
 * status chips, and rows with the right-click menu. Search ignores the month so an old
 * document is always one query away; `m=all` lists everything.
 */
export async function DocumentList({ base, filters, searchParams }: {
  base: "/estimates" | "/invoices";
  filters: ListFilter[];
  searchParams: { f?: string; q?: string; m?: string };
}) {
  const { f = "all", q = "", m } = searchParams;
  const { orgId, org } = await requireOrg();
  await expireStaleEstimates(orgId);
  const filter = filters.find((x) => x.key === f) ?? filters[0];
  const isInvoices = base === "/invoices";

  const allTime = m === "all";
  const month = monthRange(allTime ? undefined : m);
  const scopedToMonth = !allTime && !q;
  const href = (p: { f?: string; m?: string }) => {
    const sp = new URLSearchParams();
    const ff = p.f ?? f, mm = p.m ?? (allTime ? "all" : month.key);
    if (ff !== "all") sp.set("f", ff);
    if (mm !== monthRange(undefined).key) sp.set("m", mm);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };

  const where = {
    organizationId: orgId,
    kind: filter.kind,
    ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    ...(scopedToMonth ? { issueDate: { gte: month.start, lt: month.end } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { client: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }, { companyName: { contains: q, mode: "insensitive" as const } }] } },
          ],
        }
      : {}),
  };

  // Period headline: invoices → what was billed and what's paid; estimates → what was quoted and what was won
  const periodWhere = { organizationId: orgId, kind: isInvoices ? ("INVOICE" as const) : ("ESTIMATE" as const), ...(scopedToMonth ? { issueDate: { gte: month.start, lt: month.end } } : {}) };
  const [rows, totalAgg, wonAgg] = await Promise.all([
    prisma.estimate.findMany({ where, orderBy: { updatedAt: "desc" }, include: { client: true, invoice: { select: { id: true } } }, take: 100 }),
    prisma.estimate.aggregate({ where: { ...periodWhere, status: { not: "DRAFT" } }, _sum: { total: true }, _count: true }),
    prisma.estimate.aggregate({ where: { ...periodWhere, status: isInvoices ? "PAID" : "ACCEPTED" }, _sum: { total: true }, _count: true }),
  ]);

  const money = (n: unknown) => formatMoney(Number(n ?? 0), org.currency, org.locale);
  const monthLabel = allTime ? "All time" : month.start.toLocaleDateString(org.locale, { month: "long", year: "numeric" });
  const title = isInvoices ? "Invoices" : filter.kind === "CHANGE_ORDER" ? "Change orders" : "Estimates";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {!isInvoices && <Link href="/estimates/new" className={buttonVariants()}><Plus className="h-4 w-4" /> New</Link>}
      </div>

      {/* Month header */}
      <div className="rounded-2xl bg-gradient-to-b from-accent-soft to-surface border border-border px-4 py-5 text-center">
        <div className="inline-flex items-center gap-1 rounded-full bg-surface/80 border border-border px-1 h-9">
          <Link href={href({ m: shiftMonth(month.key, -1) })} aria-label="Previous month" className="h-7 w-7 grid place-items-center rounded-full hover:bg-black/5"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="text-sm font-medium px-1 min-w-[140px]">{monthLabel}</span>
          <Link href={href({ m: shiftMonth(month.key, 1) })} aria-label="Next month" className="h-7 w-7 grid place-items-center rounded-full hover:bg-black/5"><ChevronRight className="h-4 w-4" /></Link>
        </div>
        <p className="text-xs text-muted mt-4">{isInvoices ? "Invoiced" : "Quoted"}{q ? " · matching search" : ""}</p>
        <p className="text-4xl font-semibold tabular-nums tracking-tight mt-1">{money(totalAgg._sum.total)}</p>
        <p className="text-sm text-muted mt-1">
          {isInvoices ? `${money(wonAgg._sum.total)} paid` : `${money(wonAgg._sum.total)} won`} · {totalAgg._count} {isInvoices ? "invoice" : "estimate"}{totalAgg._count === 1 ? "" : "s"}
          {" · "}
          <Link href={href({ m: allTime ? monthRange(undefined).key : "all" })} className="text-accent hover:underline">{allTime ? "This month" : "All time"}</Link>
        </p>
      </div>

      <form className="flex gap-2">
        {f !== "all" && <input type="hidden" name="f" value={f} />}
        {allTime && <input type="hidden" name="m" value="all" />}
        <input name="q" defaultValue={q} placeholder="Search number, title or client…" className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" />
      </form>

      <DiscoveryHint />

      <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
        {filters.map((x) => (
          <Link key={x.key} href={href({ f: x.key })} className={cn("shrink-0 rounded-full px-3 h-8 inline-flex items-center text-sm", x.key === filter.key ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-muted")}>
            {x.label}
          </Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={isInvoices ? Receipt : filter.kind === "CHANGE_ORDER" ? FilePlus2 : FileText}
            tone={isInvoices ? "success" : filter.kind === "CHANGE_ORDER" ? "warm" : "accent"}
            title={q ? "No matches" : isInvoices ? `No invoices${scopedToMonth ? " this month" : ""}` : filter.kind === "CHANGE_ORDER" ? "No change orders yet" : `No ${filter.key === "all" ? "" : filter.label.toLowerCase() + " "}estimates${scopedToMonth ? " this month" : ""}`}
            description={
              q ? "Try a different search."
              : isInvoices ? "Accept an estimate, then use “Convert to invoice”. The invoice carries the deposit and any change orders."
              : filter.kind === "CHANGE_ORDER" ? "Open an accepted estimate and click “Change order” when the customer asks for extra work."
              : "Create an estimate and send the link — your customer can accept and sign from their phone."
            }
            action={!q && !isInvoices && filter.kind !== "CHANGE_ORDER" ? <Link href="/estimates/new" className={buttonVariants()}><Plus className="h-4 w-4" /> New estimate</Link> : scopedToMonth && !q ? <Link href={href({ m: "all" })} className={buttonVariants({ variant: "secondary" })}>Show all time</Link> : undefined}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <EstimateRowMenu as="li" key={e.id} estimate={{ id: e.id, number: e.number, kind: e.kind, status: e.status, publicToken: e.publicToken, invoiceId: e.invoice?.id ?? null, client: { firstName: e.client.firstName, phone: e.client.phone, email: e.client.email } }}>
                <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title ?? e.number}</p>
                    <p className="text-xs text-muted truncate">{e.number} · {clientDisplayName(e.client)} · {e.issueDate.toLocaleDateString(org.locale, { month: "short", day: "numeric" })}</p>
                  </div>
                  <StatusBadge status={e.status} className="hidden sm:inline-flex" />
                  <span className="sm:hidden text-[10px] text-muted">{statusLabels[e.status]}</span>
                  <span className="text-sm font-medium tabular-nums w-24 text-right">{money(e.total)}</span>
                </Link>
              </EstimateRowMenu>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
