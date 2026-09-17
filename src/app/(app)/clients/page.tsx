import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/estimates/calc";
import { clientDisplayName } from "@/lib/utils";
import { Card, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClientRowMenu } from "@/components/clients/client-row-menu";
import { DiscoveryHint } from "@/components/ui/discovery-hint";
import { formatAddress } from "@/lib/utils";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { orgId, org } = await requireOrg();

  const clients = await prisma.client.findMany({
    where: {
      organizationId: orgId,
      archivedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { addressLine1: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    include: {
      estimates: { select: { status: true, total: true }, where: { status: { not: "DRAFT" } } },
      _count: { select: { estimates: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Link href="/clients/new" className={buttonVariants()}><Plus className="h-4 w-4" /> New</Link>
      </div>

      <DiscoveryHint />

      <form>
        <input name="q" defaultValue={q} placeholder="Search name, phone, email or address…" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm" />
      </form>

      <Card>
        {clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No matches" : "No clients yet"}
            description={q ? "Try a different search." : "Clients are added automatically when you create an estimate, or add one here."}
            action={!q && <Link href="/clients/new" className={buttonVariants()}>Add client</Link>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {clients.map((c) => {
              const won = c.estimates.filter((e) => e.status === "ACCEPTED").reduce((s, e) => s + Number(e.total), 0);
              return (
                <ClientRowMenu as="li" key={c.id} client={{ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email, address: formatAddress(c).join(", ") || null }}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-background">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-black/5 grid place-items-center text-sm font-medium text-muted">
                      {c.firstName.charAt(0)}{c.lastName?.charAt(0) ?? ""}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{clientDisplayName(c)}</p>
                      <p className="text-xs text-muted truncate">
                        {[c.phone, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || c.email || "—"}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm tabular-nums">{c._count.estimates} est.</p>
                      {won > 0 && <p className="text-xs text-success tabular-nums">{formatMoney(won, org.currency, org.locale)} won</p>}
                    </div>
                    {c.tags.slice(0, 1).map((t) => <Badge key={t} className="hidden md:inline-flex">{t}</Badge>)}
                  </Link>
                </ClientRowMenu>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
