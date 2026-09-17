import { redirect } from "next/navigation";
import { DocumentList, ESTIMATE_FILTERS } from "@/components/estimates/document-list";

export const metadata = { title: "Estimates" };

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; m?: string }> }) {
  const sp = await searchParams;
  // Invoices moved to their own page; keep old links working
  if (sp.f === "invoices") redirect("/invoices");
  if (sp.f === "unpaid") redirect("/invoices?f=unpaid");
  return <DocumentList base="/estimates" filters={ESTIMATE_FILTERS} searchParams={sp} />;
}
