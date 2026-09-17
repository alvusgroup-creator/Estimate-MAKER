import { DocumentList, INVOICE_FILTERS } from "@/components/estimates/document-list";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; m?: string }> }) {
  return <DocumentList base="/invoices" filters={INVOICE_FILTERS} searchParams={await searchParams} />;
}
