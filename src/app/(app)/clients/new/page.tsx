import { createClient } from "@/lib/clients/actions";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">New client</h1>
      <ClientForm action={createClient} submitLabel="Save client" />
    </div>
  );
}
