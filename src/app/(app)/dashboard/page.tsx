import Link from "next/link";
import { AlertCircle, ArrowRight, ChevronRight, FileText, Plus } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleEstimates } from "@/lib/estimates/expire";
import { formatMoney } from "@/lib/estimates/calc";
import { clientDisplayName, cn, docWords } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EstimateRowMenu } from "@/components/estimates/estimate-row-menu";

export const metadata = { title: "Home" };

type Period = "month" | "year";

function periodStart(p: Period) {
  const d = new Date();
  return p === "month" ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), 0, 1);
}

/**
 * Home = the number the contractor cares about (won this period), what's still owed, and what
 * needs a nudge — setup gaps, open estimates, overdue invoices. Recent docs below, big create CTA.
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const [{ orgId, org }, { p }] = await Promise.all([requireOrg(), searchParams]);
  const period: Period = p === "year" ? "year" : "month";
  await expireStaleEstimates(orgId);
  const since = periodStart(period);
  const now = new Date();

  const [recent, wonMonth, wonYear, sentPeriod, open, unpaid, overdue, clientCount] = await Promise.all([
    prisma.estimate.findMany({ where: { organizationId: orgId }, orderBy: { updatedAt: "desc" }, take: 8, include: { client: true, invoice: { select: { id: true } } } }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "ESTIMATE", status: "ACCEPTED", acceptedAt: { gte: periodStart("month") } }, _sum: { total: true }, _count: true }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "ESTIMATE", status: "ACCEPTED", acceptedAt: { gte: periodStart("year") } }, _sum: { total: true }, _count: true }),
    prisma.estimate.count({ where: { organizationId: orgId, kind: "ESTIMATE", sentAt: { gte: since } } }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "ESTIMATE", status: { in: ["SENT", "VIEWED"] } }, _sum: { total: true }, _count: true }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "INVOICE", status: { in: ["DRAFT", "SENT", "VIEWED"] } }, _sum: { total: true, amountPaid: true }, _count: true }),
    prisma.estimate.aggregate({ where: { organizationId: orgId, kind: "INVOICE", status: { in: ["SENT", "VIEWED"] }, dueDate: { lt: now } }, _sum: { total: true, amountPaid: true }, _count: true }),
    prisma.client.count({ where: { organizationId: orgId, archivedAt: null } }),
  ]);

  const money = (n: unknown) => formatMoney(Number(n ?? 0), org.currency, org.locale);
  const won = period === "month" ? wonMonth : wonYear;
  const winRate = sentPeriod > 0 ? Math.round((won._count / sentPeriod) * 100) : null;
  const owed = Number(unpaid._sum.total ?? 0) - Number(unpaid._sum.amountPaid ?? 0);
  const overdueAmt = Number(overdue._sum.total ?? 0) - Number(overdue._sum.amountPaid ?? 0);
  const monthLabel = now.toLocaleDateString(org.locale, { month: "short", year: "numeric" });
  const yearLabel = String(now.getFullYear());

  // Setup nudges — the "Stripe account incomplete" card from the reference, for the things that make a document look pro
  const nudges = [
    !org.logoUrl && { title: "Add your logo", sub: "It goes on the top of every estimate and invoice.", href: "/settings?tab=branding" },
    Number(org.defaultTaxRate) === 0 && { title: "Set your sales tax rate", sub: "Applied to taxable lines by default. Leave 0 if you don't charge tax.", href: "/settings?tab=defaults" },
    !org.paymentInstructions && { title: "Add payment instructions", sub: "Zelle, check, bank details — printed on every invoice so you get paid faster.", href: "/settings?tab=defaults" },
    !org.signatureDataUrl && !org.signatureName && { title: "Add your signature", sub: "Stamped next to the customer's on accepted estimates.", href: "/settings?tab=signature" },
  ].filter((x): x is { title: string; sub: string; href: string } => !!x).slice(0, 2);

  return (
    <div className="space-y-5 pb-24 md:pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Home</h1>
          <p className="text-sm text-muted">{org.name}</p>
        </div>
        <Link href="/settings?tab=upgrade" className={cn("inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-semibold", org.plan === "PRO" ? "bg-warning text-white" : "bg-surface border border-border text-muted hover:text-foreground")}>
          {org.plan === "PRO" ? "PRO" : "Free plan"}
        </Link>
      </div>

      {/* Hero: won this period, what's owed */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-accent-soft via-surface to-surface px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <PeriodCard active={period === "month"} href="/dashboard" label={monthLabel} value={money(wonMonth._sum.total)} sub={`${wonMonth._count} won`} />
            <PeriodCard active={period === "year"} href="/dashboard?p=year" label={yearLabel} value={money(wonYear._sum.total)} sub={`${wonYear._count} won`} />
          </div>
          <div className="text-xs text-muted">{winRate === null ? "No estimates sent yet" : `${winRate}% win rate · ${sentPeriod} sent`}</div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Won · {period === "month" ? monthLabel : yearLabel}</p>
          <p className="text-[44px] sm:text-[56px] font-semibold tabular-nums tracking-tight leading-none mt-2">{money(won._sum.total)}</p>
          <p className="mt-3 text-sm">
            <span className="text-muted">Outstanding:</span>{" "}
            <Link href="/invoices?f=unpaid" className={cn("font-semibold tabular-nums", owed > 0 ? "text-danger" : "text-success")}>{money(owed)}</Link>
            {overdue._count > 0 && <span className="text-danger"> · {overdue._count} overdue ({money(overdueAmt)})</span>}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Awaiting response" value={money(open._sum.total)} sub={`${open._count} open estimate${open._count === 1 ? "" : "s"}`} href="/estimates?f=open" />
        <Stat label="Unpaid invoices" value={money(owed)} sub={`${unpaid._count} invoice${unpaid._count === 1 ? "" : "s"}`} href="/invoices?f=unpaid" tone={overdue._count > 0 ? "danger" : undefined} />
        <Stat label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub={`${sentPeriod} sent this ${period}`} />
        <Stat label="Clients" value={String(clientCount)} sub="in your book" href="/clients" />
      </div>

      {nudges.length > 0 && (
        <div className="space-y-2">
          {nudges.map((n) => (
            <Link key={n.href + n.title} href={n.href} className="flex items-center gap-3 rounded-xl bg-accent-soft/70 border border-accent/20 px-4 py-3 hover:bg-accent-soft">
              <span className="h-9 w-9 rounded-full bg-danger-soft text-danger grid place-items-center shrink-0"><AlertCircle className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.title}</span>
                <span className="block text-xs text-muted">{n.sub}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Recent</h3>
          <Link href="/estimates" className="text-sm text-accent inline-flex items-center gap-1">All <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={FileText} title="No estimates yet" description="Create your first estimate — it takes about two minutes." action={<Link href="/estimates/new" className={buttonVariants()}>New estimate</Link>} />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((e) => {
              const due = e.kind === "INVOICE" && e.status !== "PAID" && e.status !== "DRAFT" ? dueLabel(e.dueDate, now) : null;
              return (
                <EstimateRowMenu as="li" key={e.id} estimate={{ id: e.id, number: e.number, kind: e.kind, status: e.status, publicToken: e.publicToken, invoiceId: e.invoice?.id ?? null, client: { firstName: e.client.firstName, phone: e.client.phone, email: e.client.email } }}>
                  <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                    <span className="h-9 w-9 shrink-0 rounded-full bg-black/5 text-muted grid place-items-center text-xs font-semibold">{e.client.firstName.charAt(0)}{e.client.lastName?.charAt(0) ?? ""}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{clientDisplayName(e.client)}</p>
                      <p className="text-xs text-muted truncate">{docWords(e.kind).Word} {e.number}{e.title ? ` · ${e.title}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{money(e.total)}</p>
                      {due ? <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", due.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>{due.text}</span> : <StatusBadge status={e.status} className="text-[10px] px-1.5 py-0" />}
                    </div>
                  </Link>
                </EstimateRowMenu>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Big create CTA — sticky above the phone nav, inline on desktop */}
      <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-3 md:static md:px-0 md:pb-0">
        <Link href="/estimates/new" className="flex items-center justify-center gap-2 h-13 sm:h-14 rounded-2xl text-white text-[15px] font-semibold shadow-lg shadow-accent/20 hover:opacity-95" style={{ background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #60a5fa))" }}>
          <Plus className="h-5 w-5" /> Create estimate
        </Link>
      </div>
    </div>
  );
}

function dueLabel(due: Date | null, now: Date): { text: string; tone: "warn" | "danger" } | null {
  if (!due) return null;
  const days = Math.ceil((due.getTime() - now.getTime()) / 864e5);
  if (days < 0) return { text: `Overdue ${-days}d`, tone: "danger" };
  if (days === 0) return { text: "Due today", tone: "warn" };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "warn" };
  return null;
}

function PeriodCard({ active, href, label, value, sub }: { active: boolean; href: string; label: string; value: string; sub: string }) {
  return (
    <Link href={href} className={cn("rounded-xl px-4 py-3 min-w-[132px] border transition-colors", active ? "bg-surface border-accent shadow-sm" : "bg-surface/60 border-border hover:bg-surface")}>
      <span className="flex items-center justify-between text-xs text-muted">{label}<span className={cn("h-3.5 w-3.5 rounded-full border-2", active ? "border-accent bg-accent" : "border-border")} /></span>
      <span className="block text-lg font-semibold tabular-nums mt-1">{value}</span>
      <span className="block text-xs text-muted">{sub}</span>
    </Link>
  );
}

function Stat({ label, value, sub, href, tone }: { label: string; value: string; sub: string; href?: string; tone?: "danger" }) {
  const body = (
    <div className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums mt-1", tone === "danger" && "text-danger")}>{value}</p>
      <p className="text-xs text-muted mt-0.5">{sub}</p>
    </div>
  );
  return href ? <Link href={href}><Card className="hover:bg-background h-full">{body}</Card></Link> : <Card className="h-full">{body}</Card>;
}
