import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleEstimates } from "@/lib/estimates/expire";
import { formatMoney } from "@/lib/estimates/calc";
import { clientDisplayName, daysFromNow } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EstimateRowMenu } from "@/components/estimates/estimate-row-menu";

export const metadata = { title: "Home" };

export default async function DashboardPage() {
  const { orgId, org } = await requireOrg();
  await expireStaleEstimates(orgId);
  const since30d = daysFromNow(-30);

  const [recent, open, accepted30d, sent30d, unpaid, clientCount] = await Promise.all([
    prisma.estimate.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { client: true, invoice: { select: { id: true } } },
    }),
    prisma.estimate.aggregate({
      where: { organizationId: orgId, kind: "ESTIMATE", status: { in: ["SENT", "VIEWED"] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.estimate.aggregate({
      where: { organizationId: orgId, kind: "ESTIMATE", status: "ACCEPTED", acceptedAt: { gte: since30d } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.estimate.count({ where: { organizationId: orgId, kind: "ESTIMATE", sentAt: { gte: since30d } } }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "INVOICE", status: { in: ["DRAFT", "SENT", "VIEWED"] } }, _sum: { total: true, amountPaid: true }, _count: true }),
    prisma.client.count({ where: { organizationId: orgId, archivedAt: null } }),
  ]);

  const winRate = sent30d > 0 ? Math.round((accepted30d._count / sent30d) * 100) : null;
  const money = (n: unknown) => formatMoney(Number(n ?? 0), org.currency, org.locale);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Home</h1>
          <p className="text-sm text-muted">{org.name}</p>
        </div>
        <Link href="/estimates/new" className={buttonVariants({ size: "md" })}>
          <Plus className="h-4 w-4" /> New estimate
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Awaiting response" value={money(open._sum.total)} sub={`${open._count} open`} />
        <Stat label="Unpaid invoices" value={money(Number(unpaid._sum.total ?? 0) - Number(unpaid._sum.amountPaid ?? 0))} sub={`${unpaid._count} invoice${unpaid._count === 1 ? "" : "s"}`} href="/invoices?f=unpaid" />
        <Stat label="Won · 30 days" value={money(accepted30d._sum.total)} sub={`${accepted30d._count} accepted`} />
        <Stat label="Win rate · 30 days" value={winRate === null ? "—" : `${winRate}%`} sub={`${sent30d} sent`} />
        <Stat label="Clients" value={String(clientCount)} sub="in your book" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent estimates</CardTitle>
          <Link href="/estimates" className="text-sm text-accent inline-flex items-center gap-1">
            All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        {recent.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No estimates yet"
            description="Create your first estimate — it takes about two minutes."
            action={<Link href="/estimates/new" className={buttonVariants()}>New estimate</Link>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((e) => (
              <EstimateRowMenu as="li" key={e.id} estimate={{ id: e.id, number: e.number, kind: e.kind, status: e.status, publicToken: e.publicToken, invoiceId: e.invoice?.id ?? null, client: { firstName: e.client.firstName, phone: e.client.phone, email: e.client.email } }}>
                <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title ?? e.number}</p>
                    <p className="text-xs text-muted truncate">
                      {e.number} · {clientDisplayName(e.client)}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
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

function Stat({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const body = (
      <CardBody className="p-4">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
        <p className="text-xs text-muted mt-0.5">{sub}</p>
      </CardBody>
  );
  return href ? <Link href={href}><Card className="hover:bg-background">{body}</Card></Link> : <Card>{body}</Card>;
}
