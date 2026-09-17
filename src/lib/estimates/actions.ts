"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "./calc";
import { changeOrderFormSchema, estimateFormSchema, type EstimateFormValues } from "./schemas";
import { docWords } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import type { EstimateStatus, PaymentMethod } from "@/generated/prisma/enums";
import { z } from "zod";
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

type Tx = Prisma.TransactionClient;

/** Atomic "EST-1001" allocation per org. */
async function nextEstimateNumber(tx: Tx, orgId: string) {
  const org = await tx.organization.update({
    where: { id: orgId },
    data: { nextEstimateNumber: { increment: 1 } },
    select: { estimatePrefix: true, nextEstimateNumber: true },
  });
  return `${org.estimatePrefix}${org.nextEstimateNumber - 1}`;
}

/** Change orders are numbered after their estimate: "EST-1001-CO1", "-CO2"… (unique per org). */
async function nextChangeOrderNumber(tx: Tx, parentId: string) {
  const parent = await tx.estimate.findUniqueOrThrow({ where: { id: parentId }, select: { number: true, _count: { select: { changeOrders: true } } } });
  return `${parent.number}-CO${parent._count.changeOrders + 1}`;
}

export async function createEstimate(raw: unknown): Promise<SaveResult> {
  const { orgId } = await requireOrg();
  const parsed = estimateFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const client = await prisma.client.findFirst({ where: { id: parsed.data.clientId, organizationId: orgId }, select: { id: true } });
  if (!client) return { ok: false, error: "Client not found" };

  const { scalar, lines, photos } = buildWriteData(parsed.data);

  const estimate = await prisma.$transaction(async (tx) => {
    const number = await nextEstimateNumber(tx, orgId);
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { currency: true } });

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
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, id: estimate.id };
}

/**
 * Change order = extra (or removed) work on an accepted estimate, signed separately by the customer.
 * It's its own document with its own public link; the parent stays locked and untouched.
 */
export async function createChangeOrder(parentId: string, raw: unknown): Promise<SaveResult> {
  const { orgId } = await requireOrg();
  const parsed = changeOrderFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const parent = await prisma.estimate.findFirst({ where: { id: parentId, organizationId: orgId, kind: "ESTIMATE" }, select: { id: true, status: true, clientId: true, currency: true } });
  if (!parent) return { ok: false, error: "Estimate not found" };
  if (parent.status !== "ACCEPTED") return { ok: false, error: "Change orders can only be added to an accepted estimate." };

  const { scalar, lines, photos } = buildWriteData({ ...parsed.data, clientId: parent.clientId, expiresAt: null, depositType: null, depositValue: null });

  const co = await prisma.$transaction(async (tx) => {
    const number = await nextChangeOrderNumber(tx, parent.id);
    const created = await tx.estimate.create({
      data: {
        organizationId: orgId,
        kind: "CHANGE_ORDER",
        parentEstimateId: parent.id,
        number,
        currency: parent.currency,
        ...scalar,
        lineItems: { create: lines },
        photos: { create: photos },
        events: { create: { type: "CREATED", metadata: { parentId: parent.id } } },
      },
      select: { id: true },
    });
    await tx.estimateEvent.create({ data: { estimateId: parent.id, type: "CHANGE_ORDER_CREATED", metadata: { changeOrderId: created.id, number } } });
    return created;
  });

  await bumpUsage(lines.map((l) => l.serviceItemId));
  revalidatePath("/estimates");
  revalidatePath("/invoices");
  revalidatePath(`/estimates/${parent.id}`);
  revalidatePath("/dashboard");
  return { ok: true, id: co.id };
}

export async function updateEstimate(id: string, raw: unknown): Promise<SaveResult> {
  const { orgId } = await requireOrg();
  const existing = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, select: { id: true, status: true, kind: true } });
  if (!existing) return { ok: false, error: "Estimate not found" };
  if (existing.status === "ACCEPTED") return { ok: false, error: existing.kind === "ESTIMATE" ? "Accepted estimates are locked. Add a change order or duplicate it to make changes." : "Accepted change orders are locked." };
  if (existing.status === "PAID") return { ok: false, error: "Paid invoices are locked." };

  const parsed = (existing.kind === "CHANGE_ORDER" ? changeOrderFormSchema : estimateFormSchema).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };

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
  revalidatePath("/invoices");
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
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function duplicateEstimate(id: string) {
  const { orgId } = await requireOrg();
  const src = await prisma.estimate.findFirst({ where: { id, organizationId: orgId }, include: { lineItems: true } });
  if (!src) throw new Error("Not found");

  const copy = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { defaultValidDays: true } });
    const parentId = src.kind === "CHANGE_ORDER" ? src.parentEstimateId : null;
    const number = parentId ? await nextChangeOrderNumber(tx, parentId) : await nextEstimateNumber(tx, orgId);

    return tx.estimate.create({
      data: {
        organizationId: orgId,
        clientId: src.clientId,
        kind: parentId ? "CHANGE_ORDER" : "ESTIMATE",
        parentEstimateId: parentId,
        number,
        title: src.title,
        template: src.template,
        status: "DRAFT",
        issueDate: new Date(),
        expiresAt: parentId ? null : new Date(Date.now() + org.defaultValidDays * 864e5),
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
  revalidatePath("/invoices");
  redirect(`/estimates/${copy.id}/edit`);
}

export async function deleteEstimate(id: string) {
  const { orgId } = await requireOrg();
  await prisma.estimate.deleteMany({ where: { id, organizationId: orgId, status: "DRAFT" } });
  revalidatePath("/estimates");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect("/estimates");
}

/**
 * Accepted estimate → invoice. Same lines and totals, new number (INV-), due date from org default.
 * Accepted change orders are appended as their own lines and the totals recomputed, so the
 * invoice is the revised contract. One invoice per estimate (sourceEstimateId is unique);
 * re-running opens the existing one.
 */
export async function convertToInvoice(estimateId: string) {
  const { orgId } = await requireOrg();
  const src = await prisma.estimate.findFirst({
    where: { id: estimateId, organizationId: orgId, kind: "ESTIMATE" },
    include: {
      lineItems: { orderBy: { position: "asc" } }, invoice: { select: { id: true } }, photos: true,
      changeOrders: { where: { status: "ACCEPTED" }, orderBy: { createdAt: "asc" }, include: { lineItems: { orderBy: { position: "asc" } } } },
    },
  });
  if (!src) throw new Error("Not found");
  if (src.invoice) redirect(`/estimates/${src.invoice.id}`);

  // Lines = original + each accepted change order, tagged with its number
  const lineRows = [
    ...src.lineItems.map((l) => ({ serviceItemId: l.serviceItemId, name: l.name, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, taxable: l.taxable, isOptional: l.isOptional })),
    ...src.changeOrders.flatMap((co) => co.lineItems.map((l) => ({ serviceItemId: l.serviceItemId, name: `${co.number}: ${l.name}`, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, taxable: l.taxable, isOptional: l.isOptional }))),
  ];
  // A % discount was agreed on the original scope only, so it becomes the fixed amount already granted
  const hasChanges = src.changeOrders.length > 0;
  const discountType = hasChanges && src.discountType === "PERCENT" ? "FIXED" : src.discountType;
  const discountValue = hasChanges && src.discountType === "PERCENT" ? src.discountAmount : src.discountValue;
  const totals = computeTotals({
    lines: lineRows.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxable: l.taxable, isOptional: l.isOptional })),
    discountType, discountValue: discountValue == null ? null : Number(discountValue),
    taxRate: Number(src.taxRate),
    depositType: src.depositType, depositValue: src.depositValue == null ? null : Number(src.depositValue),
  });

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
        subtotal: totals.subtotal,
        discountType,
        discountValue,
        discountAmount: totals.discountAmount,
        taxRate: src.taxRate,
        taxLabel: src.taxLabel,
        taxAmount: totals.taxAmount,
        total: totals.total,
        // Deposit already collected on acceptance is carried over so the invoice shows the balance.
        // It was a share of the original total, so keep that amount rather than re-deriving it.
        depositType: src.depositType,
        depositValue: src.depositValue,
        depositAmount: src.depositAmount,
        amountPaid: src.depositAmount,
        payments: Number(src.depositAmount) > 0 ? { create: { amount: src.depositAmount, paidAt: src.acceptedAt ?? new Date(), note: "Deposit" } } : undefined,
        lineItems: { create: lineRows.map((l, i) => ({ ...l, position: i, lineTotal: totals.lineTotals[i] })) },
        photos: { create: src.photos.map((p) => ({ url: p.url, caption: p.caption, position: p.position, showOnDocument: false })) },
        events: { create: { type: "CREATED", metadata: { from: src.id } } },
      },
      select: { id: true },
    });

    await tx.estimateEvent.create({ data: { estimateId: src.id, type: "CONVERTED_TO_INVOICE", metadata: { invoiceId: created.id, number, changeOrders: src.changeOrders.map((c) => c.number) } } });
    return created;
  });

  revalidatePath("/estimates");
  revalidatePath("/invoices");
  revalidatePath(`/estimates/${estimateId}`);
  redirect(`/estimates/${inv.id}`);
}

/**
 * Re-derive amountPaid and PAID/SENT from the payment rows. Called after every payment write
 * so the persisted totals and the status never drift from the ledger.
 */
async function syncInvoicePayments(tx: Tx, id: string) {
  const inv = await tx.estimate.findUniqueOrThrow({ where: { id }, select: { total: true, status: true, payments: { select: { amount: true, paidAt: true } } } });
  const amountPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const settled = amountPaid >= Number(inv.total) - 0.005;
  const lastPaid = inv.payments.reduce<Date | null>((m, p) => (!m || p.paidAt > m ? p.paidAt : m), null);
  await tx.estimate.update({
    where: { id },
    data: {
      amountPaid,
      ...(settled && inv.status !== "PAID" ? { status: "PAID", paidAt: lastPaid ?? new Date(), events: { create: { type: "PAID" } } } : {}),
      ...(!settled && inv.status === "PAID" ? { status: "SENT", paidAt: null, events: { create: { type: "STATUS_CHANGED", metadata: { from: "PAID", to: "SENT", reason: "payment removed" } } } } : {}),
    },
  });
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Enter an amount"),
  paidAt: z.coerce.date(),
  method: z.enum(["CASH", "CHECK", "CARD", "BANK_TRANSFER", "ZELLE", "VENMO", "OTHER"]).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

/** Deposit, progress payment, final — any money received against an invoice. */
export async function recordPayment(invoiceId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { orgId } = await requireOrg();
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  const inv = await prisma.estimate.findFirst({ where: { id: invoiceId, organizationId: orgId, kind: "INVOICE" }, select: { id: true } });
  if (!inv) return { ok: false, error: "Invoice not found" };

  const { amount, paidAt, note } = parsed.data;
  const method = (parsed.data.method ?? null) as PaymentMethod | null;
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { estimateId: inv.id, amount, paidAt, method, note: note?.trim() || null } });
    await tx.estimateEvent.create({ data: { estimateId: inv.id, type: "PAYMENT_RECORDED", metadata: { amount, method } } });
    await syncInvoicePayments(tx, inv.id);
  });
  revalidatePath(`/estimates/${inv.id}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePayment(paymentId: string) {
  const { orgId } = await requireOrg();
  const p = await prisma.payment.findFirst({ where: { id: paymentId, estimate: { organizationId: orgId } }, select: { id: true, estimateId: true } });
  if (!p) throw new Error("Not found");
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: p.id } });
    await syncInvoicePayments(tx, p.estimateId);
  });
  revalidatePath(`/estimates/${p.estimateId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

/** "Mark as paid" = record one payment for whatever is still owed. */
export async function markInvoicePaid(id: string) {
  const { orgId } = await requireOrg();
  const inv = await prisma.estimate.findFirst({ where: { id, organizationId: orgId, kind: "INVOICE" }, select: { total: true, amountPaid: true } });
  if (!inv) throw new Error("Not found");
  const balance = Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100;
  if (balance > 0) await recordPayment(id, { amount: balance, paidAt: new Date(), note: "Paid in full" });
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
  if (e.status === "EXPIRED") return { ok: false, error: `This ${docWords(e.kind).word} has expired — reopen it or duplicate it first.` };

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
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true };
}
