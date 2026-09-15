import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, MessageSquare, Pencil, Phone, Plus } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/estimates/calc";
import { clientDisplayName, formatAddress } from "@/lib/utils";
import { archiveClient } from "@/lib/clients/actions";
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EstimateRowMenu } from "@/components/estimates/estimate-row-menu";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, org } = await requireOrg();
  const client = await prisma.client.findFirst({
    where: { id, organizationId: orgId },
    include: { estimates: { orderBy: { updatedAt: "desc" }, include: { invoice: { select: { id: true } } } } },
  });
  if (!client) notFound();

  const money = (n: unknown) => formatMoney(Number(n ?? 0), org.currency, org.locale);
  const won = client.estimates.filter((e) => e.status === "ACCEPTED");
  const wonTotal = won.reduce((s, e) => s + Number(e.total), 0);
  const address = formatAddress(client);
  const mapsHref = address.length ? `https://maps.google.com/?q=${encodeURIComponent(address.join(", "))}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/clients" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{clientDisplayName(client)}</h1>
          <p className="text-sm text-muted">Client since {client.createdAt.toLocaleDateString(org.locale, { month: "short", year: "numeric" })}</p>
        </div>
        <Link href={`/clients/${id}/edit`} className={buttonVariants({ variant: "secondary" })}><Pencil className="h-4 w-4" /> Edit</Link>
      </div>

      {/* One-tap actions — the reason a contractor opens a client on the phone */}
      <div className="grid grid-cols-4 gap-2">
        <QuickAction href={client.phone ? `tel:${client.phone}` : undefined} icon={Phone} label="Call" />
        <QuickAction href={client.phone ? `sms:${client.phone}` : undefined} icon={MessageSquare} label="Text" />
        <QuickAction href={client.email ? `mailto:${client.email}` : undefined} icon={Mail} label="Email" />
        <QuickAction href={mapsHref ?? undefined} icon={MapPin} label="Map" external />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
        <Card>
          <CardHeader>
            <CardTitle>Estimates</CardTitle>
            <Link href={`/estimates/new?client=${id}`} className={buttonVariants({ size: "sm" })}><Plus className="h-4 w-4" /> New estimate</Link>
          </CardHeader>
          {client.estimates.length === 0 ? (
            <EmptyState title="No estimates yet" />
          ) : (
            <ul className="divide-y divide-border">
              {client.estimates.map((e) => (
                <EstimateRowMenu as="li" key={e.id} estimate={{ id: e.id, number: e.number, kind: e.kind, status: e.status, publicToken: e.publicToken, invoiceId: e.invoice?.id ?? null, client: { firstName: client.firstName, phone: client.phone, email: client.email } }}>
                  <Link href={`/estimates/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.title ?? e.number}</p>
                      <p className="text-xs text-muted">{e.number} · {e.updatedAt.toLocaleDateString(org.locale, { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <StatusBadge status={e.status} />
                    <span className="text-sm font-medium tabular-nums w-24 text-right">{money(e.total)}</span>
                  </Link>
                </EstimateRowMenu>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 text-sm">
              {client.phone && <Row label="Phone"><a href={`tel:${client.phone}`} className="text-accent">{client.phone}</a></Row>}
              {client.email && <Row label="Email"><a href={`mailto:${client.email}`} className="text-accent break-all">{client.email}</a></Row>}
              {address.length > 0 && <Row label="Address">{address.map((l, i) => <span key={i} className="block">{l}</span>)}</Row>}
              {client.notes && <Row label="Notes"><span className="whitespace-pre-line">{client.notes}</span></Row>}
              {!client.phone && !client.email && address.length === 0 && !client.notes && <p className="text-muted">No contact details yet.</p>}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-muted">Won</p><p className="text-lg font-semibold tabular-nums">{money(wonTotal)}</p><p className="text-xs text-muted">{won.length} job{won.length === 1 ? "" : "s"}</p></div>
              <div><p className="text-xs text-muted">Estimates</p><p className="text-lg font-semibold tabular-nums">{client.estimates.length}</p><p className="text-xs text-muted">{client.estimates.filter((e) => e.status === "SENT" || e.status === "VIEWED").length} open</p></div>
            </CardBody>
          </Card>

          <form action={archiveClient.bind(null, id)}>
            <Button type="submit" variant="ghost" size="sm" className="w-full text-muted">Archive client</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, external }: { href?: string; icon: typeof Phone; label: string; external?: boolean }) {
  const cls = "flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface h-16 text-xs font-medium";
  if (!href) return <div className={`${cls} opacity-40`}><Icon className="h-5 w-5" />{label}</div>;
  return (
    <a href={href} className={`${cls} hover:bg-background`} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      <Icon className="h-5 w-5" />{label}
    </a>
  );
}
