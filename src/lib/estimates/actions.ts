"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "./calc";
import { estimateFormSchema, type EstimateFormValues } from "./schemas";
import type { EstimateStatus } from "@/generated/prisma/enums";
import { emailEnabled, sendEmail } from "@/lib/email/send";
import { customerDocumentEmail } from "@/lib/email/templates";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

function buildWriteData(values: EstimateFormValues) {
  const totals = computeTotals({
    lines: values.lineItems,
    discountType: values.discountType ?? null,
    discountValue: values.discountValue ?? null,
    taxRate: values.taxRate,
    depositType: values.depositType ?? null,
    depositValue: values.depositValue ?? null,
  });

  return {
    scalar: {
      clientId: values.clientId,
      title: values.title || null,
      template: values.template,
      issueDate: values.issueDate,
      expiresAt: values.expiresAt ?? null,
      dueDate: values.dueDate ?? null,
      jobAddressLine1: values.jobAddressLine1 || null,
      jobAddressLine2: values.jobAddressLine2 || null,
      jobCity: values.jobCity || null,
      jobState: values.jobState || null,
      jobPostalCode: values.jobPostalCode || null,
      notes: values.notes || null,
      terms: values.terms || null,
      internalNotes: values.internalNotes || null,
      discountType: values.discountType ?? null,
      discountValue: values.discountValue ?? null,
      discountAmount: totals.discountAmount,
      taxRate: values.taxRate,
      taxLabel: values.taxLabel,
      taxAmount: totals.taxAmount,
      subtotal: totals.subtotal,
      total: totals.total,
      depositType: values.depositType ?? null,
      depositValue: values.depositValue ?? null,
      depositAmount: totals.depositAmount,
    },
    lines: values.lineItems.map((l, i) => ({
      position: i,
      serviceItemId: l.serviceItemId ?? null,
      name: l.name,
      description: l.description || null,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      taxable: l.taxable,
      isOptional: l.isOptional,
      lineTotal: totals.lineTotals[i],
    })),
    photos: values.photos.map((p, i) => ({ url: p.url, caption: p.caption || null, showOnDocument: p.showOnDocument, position: i })),
  };
}

async function bumpUsage(serviceItemIds: (string | null | undefined)[]) {
  const ids = [...new Set(serviceItemIds.filter((x): x is string => !!x))];
  if (ids.length) await prisma.serviceItem.updateMany({ where: { id: { in: ids } }, data: { usageCount: { increment: 1 } } });
}

export async function createEstimate(raw: unknown): Promise<SaveResult> {
  const { orgId } = await requireOrg();
  const parsed = estimateFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, organizationId: orgId }, select: { id: true } });
  if (!client) return { ok: false, error: "Client not found" };

  const { scalar, lines, photos } = buildWriteData(parsed.data);

  const estimate = await prisma.$transaction(async (tx) => {
    // Atomic number allocation per org
    const org = await tx.organization.update({
      where: { id: orgId },
      data: { nextEstimateNumber: { increment: 1 } },
      select: { estimatePrefix: true, nextEstimateNumber: true, currency: true },
    });
    const number = `${org.estimatePrefix}${org.nextEstimateNumber - 1}`;

    return tx.estimate.create({
      data: {
        organizationId: orgId,
        number,
        currency: org.currency,
        ...scalar,
        lineItems: { create: lines },
        photos: { create: photos },
        events: { create: { type: "CREATED" } },
      },
      select: { id: true },
    });
  });

  await bumpUsage(lines.map((l) => l.serviceItemId));
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { ok: true, id: estimate.id };
}

export async function updateEstimate(id: string, raw: unknown): Promise<SaveResult> {
  const { orgId } = await requireOrg();
  const parsed = estimateFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const existing = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, select: { id: true, status: true } });
  if (!existing) return { ok: false, error: "Estimate not found" };
  if (existing.status === "ACCEPTED") return { ok: false, error: "Accepted estimates are locked. Duplicate it to make changes." };
  if (existing.status === "PAID") return { ok: false, error: "Paid invoices are locked." };

  const { scalar, lines, photos } = buildWriteData(parsed.data);

  await prisma.$transaction([
    prisma.estimateLineItem.deleteMany({ where: { estimateId: id } }),
    prisma.estimatePhoto.deleteMany({ where: { estimateId: id } }),
    prisma.estimate.update({
      where: { id },
      data: { ...scalar, lineItems: { create: lines }, photos: { create: photos } },
    }),
  ]);

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function setEstimateStatus(id: string, status: EstimateStatus) {
  const { orgId } = await requireOrg();
  const existing = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, select: { status: true } });
  if (!existing) throw new Error("Not found");

  const now = new Date();
  const stamps: Record<string, Date> = {};
  if (status === "SENT" && existing.status === "DRAFT") stamps.sentAt = now;
  if (status === "ACCEPTED") stamps.acceptedAt = now;
  if (status === "DECLINED") stamps.declinedAt = now;

  await prisma.estimate.update({
    where: { id },
    data: {
      status,
      ...stamps,
      events: {
        create: {
          type: status === "SENT" ? "SENT" : status === "ACCEPTED" ? "ACCEPTED" : status === "DECLINED" ? "DECLINED" : "STATUS_CHANGED",
          metadata: { from: existing.status, to: status, by: "contractor" },
        },
      },
    },
  });

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
}

export async function duplicateEstimate(id: string) {
  const { orgId } = await requireOrg();
  const src = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, include: { lineItems: true } });
  if (!src) throw new Error("Not found");

  const copy = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: orgId },
      data: { nextEstimateNumber: { increment: 1 } },
      select: { estimatePrefix: true, nextEstimateNumber: true, defaultValidDays: true },
    });
    const number = `${org.estimatePrefix}${org.nextEstimateNumber - 1}`;

    return tx.estimate.create({
      data: {
        organizationId: orgId,
        clientId: src.clientId,
        number,
        title: src.title,
        template: src.template,
        status: "DRAFT",
        issueDate: new Date(),
        expiresAt: new Date(Date.now() + org.defaultValidDays * 864e5),
        jobAddressLine1: src.jobAddressLine1,
        jobAddressLine2: src.jobAddressLine2,
        jobCity: src.jobCity,
        jobState: src.jobState,
        jobPostalCode: src.jobPostalCode,
        notes: src.notes,
        terms: src.terms,
        internalNotes: src.internalNotes,
        currency: src.currency,
        subtotal: src.subtotal,
        discountType: src.discountType,
        discountValue: src.discountValue,
        discountAmount: src.discountAmount,
        taxRate: src.taxRate,
        taxLabel: src.taxLabel,
        taxAmount: src.taxAmount,
        total: src.total,
        depositType: src.depositType,
        depositValue: src.depositValue,
        depositAmount: src.depositAmount,
        lineItems: {
          create: src.lineItems.map((l) => ({
            position: l.position,
            serviceItemId: l.serviceItemId,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
            taxable: l.taxable,
            isOptional: l.isOptional,
            lineTotal: l.lineTotal,
          })),
        },
        events: { create: { type: "DUPLICATED", metadata: { from: src.id } } },
      },
      select: { id: true },
    });
  });

  revalidatePath("/estimates");
  redirect(`/estimates/${copy.id}/edit`);
}

export async function deleteEstimate(id: string) {
  const { orgId } = await requireOrg();
  await prisma.estimate.deleteMany({ where: { id, organizationId: orgId, status: "DRAFT" } });
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  redirect("/estimates");
}

/**
 * Accepted estimate → invoice. Same lines and totals, new number (INV-), due date from org default.
 * One invoice per estimate (sourceEstimateId is unique); re-running opens the existing one.
 */
export async function convertToInvoice(estimateId: string) {
  const { orgId } = await requireOrg();
  const src = await prisma.estimate.findFirst({
    where: { id: estimateId, organizationId: orgId, kind: "ESTIMATE" },
    include: { lineItems: true, invoice: { select: { id: true } }, photos: true },
  });
  if (!src) throw new Error("Not found");
  if (src.invoice) redirect(`/estimates/${src.invoice.id}`);

  const inv = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: orgId },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { invoicePrefix: true, nextInvoiceNumber: true, defaultDueDays: true },
    });
    const number = `${org.invoicePrefix}${org.nextInvoiceNumber - 1}`;

    const created = await tx.estimate.create({
      data: {
        organizationId: orgId,
        kind: "INVOICE",
        sourceEstimateId: src.id,
        clientId: src.clientId,
        number,
        title: src.title,
        template: src.template,
        status: "DRAFT",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + org.defaultDueDays * 864e5),
        jobAddressLine1: src.jobAddressLine1,
        jobAddressLine2: src.jobAddressLine2,
        jobCity: src.jobCity,
        jobState: src.jobState,
        jobPostalCode: src.jobPostalCode,
        notes: src.notes,
        terms: src.terms,
        internalNotes: src.internalNotes,
        currency: src.currency,
        subtotal: src.subtotal,
        discountType: src.discountType,
        discountValue: src.discountValue,
        discountAmount: src.discountAmount,
        taxRate: src.taxRate,
        taxLabel: src.taxLabel,
        taxAmount: src.taxAmount,
        total: src.total,
        // Deposit already collected on acceptance is carried over so the invoice shows the balance
        depositType: src.depositType,
        depositValue: src.depositValue,
        depositAmount: src.depositAmount,
        lineItems: {
          create: src.lineItems.map((l) => ({
            position: l.position, serviceItemId: l.serviceItemId, name: l.name, description: l.description,
            quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, taxable: l.taxable, isOptional: l.isOptional, lineTotal: l.lineTotal,
          })),
        },
        photos: { create: src.photos.map((p) => ({ url: p.url, caption: p.caption, position: p.position, showOnDocument: false })) },
        events: { create: { type: "CREATED", metadata: { from: src.id } } },
      },
      select: { id: true },
    });

    await tx.estimateEvent.create({ data: { estimateId: src.id, type: "CONVERTED_TO_INVOICE", metadata: { invoiceId: created.id, number } } });
    return created;
  });

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  redirect(`/estimates/${inv.id}`);
}

export async function markInvoicePaid(id: string, paid: boolean) {
  const { orgId } = await requireOrg();
  const inv = await prisma.estimate.findFirst({ where: { id, organizationId: orgId, kind: "INVOICE" }, select: { status: true } });
  if (!inv) throw new Error("Not found");
  await prisma.estimate.update({
    where: { id },
    data: paid
      ? { status: "PAID", paidAt: new Date(), events: { create: { type: "PAID" } } }
      : { status: "SENT", paidAt: null, events: { create: { type: "STATUS_CHANGED", metadata: { from: "PAID", to: "SENT" } } } },
  });
  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
}

/**
 * Send the document to the customer by email (Resend) with the public link.
 * Marks a draft as SENT and records an EMAILED event with the recipient.
 */
export async function emailEstimate(
  id: string,
  input: { to: string; message?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId, org } = await requireOrg();
  if (!emailEnabled()) return { ok: false, error: "Email sending is not configured yet." };

  const to = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: "Enter a valid email address." };
  const message = (input.message ?? "").trim().slice(0, 2000) || null;

  const e = await prisma.estimate.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true, number: true, kind: true, title: true, status: true, total: true, currency: true, expiresAt: true, dueDate: true, publicToken: true, client: { select: { firstName: true, email: true } } },
  });
  if (!e) return { ok: false, error: "Not found" };
  if (e.status === "EXPIRED") return { ok: false, error: "This estimate has expired — reopen it or duplicate it first." };

  const mail = customerDocumentEmail({
    doc: {
      number: e.number, kind: e.kind, title: e.title, total: Number(e.total), currency: e.currency, locale: org.locale,
      publicUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/e/${e.publicToken}`, expiresAt: e.expiresAt, dueDate: e.dueDate,
    },
    org: { name: org.name, phone: org.phone, email: org.email, primaryColor: org.primaryColor },
    firstName: e.client.firstName,
    message,
  });
  const r = await sendEmail({ to, ...mail, fromName: org.name, replyTo: org.email });
  if (!r.ok) return { ok: false, error: `Email failed: ${r.error}` };

  await prisma.$transaction([
    prisma.estimate.update({
      where: { id },
      data: {
        ...(e.status === "DRAFT" ? { status: "SENT", sentAt: new Date() } : {}),
        events: { create: { type: "EMAILED", metadata: { to, messageId: r.id } } },
      },
    }),
    // Remember the address on the client if they had none
    ...(e.client.email ? [] : [prisma.client.updateMany({ where: { estimates: { some: { id } }, organizationId: orgId, email: null }, data: { email: to } })]),
  ]);

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return { ok: true };
}
