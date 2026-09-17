import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { loadEditorData, loadEstimate } from "@/lib/estimates/queries";
import { EstimateEditor } from "@/components/estimates/estimate-editor";

export const metadata = { title: "Edit estimate" };

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, org } = await requireOrg();
  const [data, estimate] = await Promise.all([loadEditorData(orgId, org), loadEstimate(orgId, id)]);
  if (!estimate) notFound();
  if (estimate.status === "ACCEPTED") redirect(`/estimates/${id}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit {estimate.kind === "CHANGE_ORDER" ? "change order " : ""}{estimate.number}</h1>
      <EstimateEditor {...data} estimate={estimate} />
    </div>
  );
}
