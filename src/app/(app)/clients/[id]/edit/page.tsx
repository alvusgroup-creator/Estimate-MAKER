import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateClient } from "@/lib/clients/actions";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireOrg();
  const client = await prisma.client.findFirst({ where: { id, organizationId: orgId } });
  if (!client) notFound();

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Edit client</h1>
      <ClientForm client={client} action={updateClient.bind(null, id)} submitLabel="Save changes" />
    </div>
  );
}
