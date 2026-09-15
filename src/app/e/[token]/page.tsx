import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { toEstimateDTO, toOrgBranding } from "@/lib/estimates/dto";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { PublicActions } from "./public-actions";
import { PrintTrigger } from "./print-trigger";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { expireStaleEstimates } from "@/lib/estimates/expire";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await prisma.estimate.findUnique({ where: { publicToken: token }, select: { number: true, kind: true, organization: { select: { name: true } } } });
  return { title: e ? `${e.kind === "INVOICE" ? "Invoice" : "Estimate"} ${e.number} · ${e.organization.name}` : "Estimate", robots: { index: false } };
}

export default async function PublicEstimatePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> }) {
  const [{ token }, { print }, hdrs] = await Promise.all([params, searchParams, headers()]);

  const raw = await prisma.estimate.findUnique({
    where: { publicToken: token },
    include: { client: true, lineItems: true, photos: true, organization: true, invoice: { select: { id: true } } },
  });
  if (!raw) notFound();

  // Drafts are private: only the owning contractor (signed in) can preview them.
  let ownerPreview = false;
  if (raw.status === "DRAFT") {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const member = user ? await prisma.user.findFirst({ where: { id: user.id, organizationId: raw.organizationId }, select: { id: true } }) : null;
    if (!member) notFound();
    ownerPreview = true;
  }

  // Lazily expire if the customer opens a stale link
  if (raw.kind === "ESTIMATE" && (raw.status === "SENT" || raw.status === "VIEWED") && raw.expiresAt && raw.expiresAt < new Date()) {
    await expireStaleEstimates(raw.organizationId);
    raw.status = "EXPIRED";
  }

  // Track the view (first view flips SENT → VIEWED). Never count the contractor's own print view,
  // and count at most one view per IP per hour so refreshes don't inflate the number.
  if (!print && !ownerPreview && rateLimit(`view:${token}:${clientIp(hdrs)}`, 1, 3_600_000)) {
    await prisma.estimate.update({
      where: { id: raw.id },
      data: {
        viewCount: { increment: 1 },
        ...(raw.viewedAt ? {} : { viewedAt: new Date() }),
        ...(raw.status === "SENT" ? { status: "VIEWED" } : {}),
        events: { create: { type: "VIEWED", metadata: { ua: hdrs.get("user-agent")?.slice(0, 200) ?? null } } },
      },
    });
  }

  const estimate = toEstimateDTO(raw);
  const org = toOrgBranding(raw.organization);
  const canRespond = raw.kind === "ESTIMATE" && (raw.status === "SENT" || raw.status === "VIEWED");

  return (
    <main className="min-h-screen bg-neutral-100 print:bg-white">
      <div className="mx-auto max-w-3xl px-0 sm:px-4 py-0 sm:py-8 print:p-0 print:max-w-none">
        <div className="bg-white sm:rounded-xl sm:shadow-sm print:shadow-none">
          <EstimateDocument
            template={estimate.template}
            org={org}
            data={{
              ...estimate,
              jobAddress: { addressLine1: estimate.jobAddressLine1, addressLine2: estimate.jobAddressLine2, city: estimate.jobCity, state: estimate.jobState, postalCode: estimate.jobPostalCode },
              lines: estimate.lineItems,
              photos: estimate.photos.filter((p) => p.showOnDocument),
            }}
          />
        </div>
        {ownerPreview && (
          <p className="print:hidden mx-4 sm:mx-0 mb-3 rounded-lg bg-amber-100 text-amber-900 text-sm px-4 py-2">Draft preview — only you can see this. Send it to make the link public.</p>
        )}
        <div className="print:hidden">
          <PublicActions token={token} status={raw.status} kind={raw.kind} canRespond={canRespond} orgName={org.name} orgPhone={org.phone} orgEmail={org.email} />
        </div>
      </div>
      {print && <PrintTrigger />}
    </main>
  );
}
