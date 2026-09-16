/**
 * Plain-JSON shapes that cross the server → client boundary.
 * Prisma Decimals become numbers here and nowhere else.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { DiscountType, DocumentKind, EstimateStatus, Template, Unit } from "@/generated/prisma/enums";

export type OrgBranding = {
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  licenseNo: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  appColor: string | null;
  signatureDataUrl: string | null;
  signatureName: string | null;
  currency: string;
  locale: string;
};

export type ClientDTO = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type ServiceItemDTO = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: Unit;
  unitPrice: number;
  taxable: boolean;
};

export type LineItemDTO = {
  id?: string;
  serviceItemId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  taxable: boolean;
  isOptional: boolean;
  lineTotal: number;
};

export type PhotoDTO = { id?: string; url: string; caption: string | null; showOnDocument: boolean };

export type EstimateDTO = {
  id: string;
  kind: DocumentKind;
  number: string;
  title: string | null;
  status: EstimateStatus;
  template: Template;
  issueDate: string;
  expiresAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  sourceEstimateId: string | null;
  invoiceId: string | null;
  clientId: string;
  client: ClientDTO;
  jobAddressLine1: string | null;
  jobAddressLine2: string | null;
  jobCity: string | null;
  jobState: string | null;
  jobPostalCode: string | null;
  notes: string | null;
  terms: string | null;
  internalNotes: string | null;
  currency: string;
  subtotal: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmount: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  total: number;
  depositType: DiscountType | null;
  depositValue: number | null;
  depositAmount: number;
  publicToken: string;
  sentAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  acceptedAt: string | null;
  declinedAt: string | null;
  signerName: string | null;
  signatureDataUrl: string | null;
  lineItems: LineItemDTO[];
  photos: PhotoDTO[];
};

type EstimateWithRelations = Prisma.EstimateGetPayload<{ include: { client: true; lineItems: true; photos: true; invoice: { select: { id: true } } } }>;

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toClientDTO(c: Prisma.ClientGetPayload<object>): ClientDTO {
  const { id, firstName, lastName, companyName, email, phone, addressLine1, addressLine2, city, state, postalCode } = c;
  return { id, firstName, lastName, companyName, email, phone, addressLine1, addressLine2, city, state, postalCode };
}

export function toServiceItemDTO(s: Prisma.ServiceItemGetPayload<object>): ServiceItemDTO {
  return { id: s.id, name: s.name, description: s.description, category: s.category, unit: s.unit, unitPrice: Number(s.unitPrice), taxable: s.taxable };
}

export function toEstimateDTO(e: EstimateWithRelations): EstimateDTO {
  return {
    id: e.id,
    kind: e.kind,
    number: e.number,
    title: e.title,
    status: e.status,
    template: e.template,
    issueDate: e.issueDate.toISOString(),
    expiresAt: iso(e.expiresAt),
    dueDate: iso(e.dueDate),
    paidAt: iso(e.paidAt),
    sourceEstimateId: e.sourceEstimateId,
    invoiceId: e.invoice?.id ?? null,
    clientId: e.clientId,
    client: toClientDTO(e.client),
    jobAddressLine1: e.jobAddressLine1,
    jobAddressLine2: e.jobAddressLine2,
    jobCity: e.jobCity,
    jobState: e.jobState,
    jobPostalCode: e.jobPostalCode,
    notes: e.notes,
    terms: e.terms,
    internalNotes: e.internalNotes,
    currency: e.currency,
    subtotal: Number(e.subtotal),
    discountType: e.discountType,
    discountValue: num(e.discountValue),
    discountAmount: Number(e.discountAmount),
    taxRate: Number(e.taxRate),
    taxLabel: e.taxLabel,
    taxAmount: Number(e.taxAmount),
    total: Number(e.total),
    depositType: e.depositType,
    depositValue: num(e.depositValue),
    depositAmount: Number(e.depositAmount),
    publicToken: e.publicToken,
    sentAt: iso(e.sentAt),
    viewedAt: iso(e.viewedAt),
    viewCount: e.viewCount,
    acceptedAt: iso(e.acceptedAt),
    declinedAt: iso(e.declinedAt),
    signerName: e.signerName,
    signatureDataUrl: e.signatureDataUrl,
    lineItems: [...e.lineItems]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        id: l.id,
        serviceItemId: l.serviceItemId,
        name: l.name,
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitPrice: Number(l.unitPrice),
        taxable: l.taxable,
        isOptional: l.isOptional,
        lineTotal: Number(l.lineTotal),
      })),
    photos: [...e.photos].sort((a, b) => a.position - b.position).map((p) => ({ id: p.id, url: p.url, caption: p.caption, showOnDocument: p.showOnDocument })),
  };
}

export function toOrgBranding(o: Prisma.OrganizationGetPayload<object>): OrgBranding {
  const { name, email, phone, website, licenseNo, addressLine1, addressLine2, city, state, postalCode, logoUrl, primaryColor, accentColor, appColor, signatureDataUrl, signatureName, currency, locale } = o;
  return { name, email, phone, website, licenseNo, addressLine1, addressLine2, city, state, postalCode, logoUrl, primaryColor, accentColor, appColor, signatureDataUrl, signatureName, currency, locale };
}
