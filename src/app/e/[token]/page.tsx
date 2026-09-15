import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { toEstimateDTO, toOrgBranding } from "@/lib/estimates/dto";
import { EstimateDocument } from "@/components/templates/estimate-document";
import { PublicActions } from "./public-actions";
import { PrintTrigger } from "./print-trigger";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await prisma.estimate.findUnique({ where: { publicToken: token }, select: { number: true, organization: { select: { name: true } } } });
  return { title: e ? `Estimate ${e.number} · ${e.organization.name}` : "Estimate", robots: { index: false } };
}

export default async function PublicEstimatePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> }) {
  const [{ token }, { print }, hdrs] = await Promise.all([params, searchParams, headers()]);

  const raw = await prisma.estimate.findUnique({
    where: { publicToken: token },
    include: { client: true, lineItems: true, organization: true },
  });
  if (!raw || raw.status === "DRAFT") notFound();

  // Track the view (first view flips SENT → VIEWED). Never count the contractor's own print view.
  if (!print) {
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
  const canRespond = raw.status === "SENT" || raw.status === "VIEWED";

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
            }}
          />
        </div>
        <div className="print:hidden">
          <PublicActions token={token} status={raw.status} canRespond={canRespond} orgName={org.name} orgPhone={org.phone} orgEmail={org.email} />
        </div>
      </div>
      {print && <PrintTrigger />}
    </main>
  );
}
