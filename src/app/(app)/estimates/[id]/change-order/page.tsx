import { notFound, redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { loadEditorData, loadEstimate } from "@/lib/estimates/queries";
import { EstimateEditor } from "@/components/estimates/estimate-editor";

export const metadata = { title: "New change order" };

/** New change order on an accepted estimate. The editor inherits client, job site, tax and template from the parent. */
export default async function NewChangeOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId, org } = await requireOrg();
  const [data, parent] = await Promise.all([loadEditorData(orgId, org), loadEstimate(orgId, id)]);
  if (!parent || parent.kind !== "ESTIMATE") notFound();
  if (parent.status !== "ACCEPTED") redirect(`/estimates/${id}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New change order</h1>
      <EstimateEditor {...data} changeOrderOf={parent} />
    </div>
  );
}
