import { requireOrg } from "@/lib/auth";
import { loadEditorData } from "@/lib/estimates/queries";
import { EstimateEditor } from "@/components/estimates/estimate-editor";

export const metadata = { title: "New estimate" };

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [{ orgId, org }, { client }] = await Promise.all([requireOrg(), searchParams]);
  const data = await loadEditorData(orgId, org);
  const preselect = client && data.clients.some((c) => c.id === client) ? client : undefined;

  return (
    <div>
      <EstimateEditor {...data} preselectClientId={preselect} />
    </div>
  );
}
