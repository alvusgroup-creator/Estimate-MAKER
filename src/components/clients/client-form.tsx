import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { Client } from "@/generated/prisma/client";

/** Server-rendered form; `action` is a server action bound to create or update. */
export function ClientForm({ client, action, submitLabel }: { client?: Client; action: (fd: FormData) => Promise<void>; submitLabel: string }) {
  return (
    <form action={action} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name *"><Input name="firstName" required defaultValue={client?.firstName} autoFocus={!client} /></Field>
            <Field label="Last name"><Input name="lastName" defaultValue={client?.lastName ?? ""} /></Field>
          </div>
          <Field label="Company (optional)"><Input name="companyName" defaultValue={client?.companyName ?? ""} placeholder="For landlords, HOAs, property managers…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input name="phone" type="tel" inputMode="tel" defaultValue={client?.phone ?? ""} /></Field>
            <Field label="Email"><Input name="email" type="email" inputMode="email" defaultValue={client?.email ?? ""} /></Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Property address</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <Input name="addressLine1" placeholder="Street" defaultValue={client?.addressLine1 ?? ""} />
          <Input name="addressLine2" placeholder="Unit / suite (optional)" defaultValue={client?.addressLine2 ?? ""} />
          <div className="grid grid-cols-6 gap-3">
            <Input name="city" className="col-span-3" placeholder="City" defaultValue={client?.city ?? ""} />
            <Input name="state" className="col-span-1 uppercase" placeholder="ST" maxLength={2} defaultValue={client?.state ?? ""} />
            <Input name="postalCode" className="col-span-2" placeholder="ZIP" defaultValue={client?.postalCode ?? ""} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardBody>
          <Textarea name="notes" defaultValue={client?.notes ?? ""} placeholder="Gate code, dog in the yard, prefers texts, referred by…" />
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg">{submitLabel}</Button>
      </div>
    </form>
  );
}
