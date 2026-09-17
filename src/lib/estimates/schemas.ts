import { z } from "zod";

export const unitEnum = z.enum(["HOUR", "DAY", "SQFT", "LINEAR_FT", "EACH", "FLAT", "CUBIC_YD", "GALLON"]);
export const discountTypeEnum = z.enum(["PERCENT", "FIXED"]);
export const templateEnum = z.enum(["CLEAN", "BOLD", "CLASSIC", "NOIR", "MINIMAL", "EXECUTIVE"]);

export const lineItemSchema = z.object({
  id: z.string().optional(),
  serviceItemId: z.string().nullable().optional(),
  name: z.string().min(1, "Required").max(200),
  description: z.string().max(2000).nullable().optional(),
  quantity: z.coerce.number().positive(),
  unit: unitEnum,
  unitPrice: z.coerce.number().min(0),
  taxable: z.boolean().default(true),
  isOptional: z.boolean().default(false),
});

export const photoSchema = z.object({
  url: z.string().url().max(1000),
  caption: z.string().max(200).nullable().optional(),
  showOnDocument: z.boolean().default(true),
});

export const estimateFormSchema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  title: z.string().max(200).nullable().optional(),
  template: templateEnum,
  issueDate: z.coerce.date(),
  expiresAt: z.coerce.date().nullable().optional(),
  jobAddressLine1: z.string().nullable().optional(),
  jobAddressLine2: z.string().nullable().optional(),
  jobCity: z.string().nullable().optional(),
  jobState: z.string().nullable().optional(),
  jobPostalCode: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  terms: z.string().max(5000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  discountType: discountTypeEnum.nullable().optional(),
  discountValue: z.coerce.number().min(0).nullable().optional(),
  taxRate: z.coerce.number().min(0).max(1),
  taxLabel: z.string().max(40).default("Sales Tax"),
  depositType: discountTypeEnum.nullable().optional(),
  depositValue: z.coerce.number().min(0).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line"),
  photos: z.array(photoSchema).max(20).default([]),
});

/** Change orders can credit the customer (scope removed), so a line's rate may be negative. */
export const changeOrderFormSchema = estimateFormSchema.extend({
  lineItems: z.array(lineItemSchema.extend({ unitPrice: z.coerce.number() })).min(1, "Add at least one line"),
});

export type EstimateFormValues = z.output<typeof estimateFormSchema>;
export type EstimateFormInput = z.input<typeof estimateFormSchema>;
export type LineItemValues = z.infer<typeof lineItemSchema>;

export const clientSchema = z.object({
  firstName: z.string().min(1, "Required").max(100),
  lastName: z.string().max(100).nullable().optional(),
  companyName: z.string().max(200).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(30).nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().max(2).nullable().optional(),
  postalCode: z.string().max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export const serviceItemSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  unit: unitEnum,
  unitPrice: z.coerce.number().min(0),
  taxable: z.boolean().default(true),
  isMaterial: z.boolean().default(false),
});

export const UNIT_LABELS: Record<z.infer<typeof unitEnum>, string> = {
  HOUR: "hr",
  DAY: "day",
  SQFT: "sq ft",
  LINEAR_FT: "lin ft",
  EACH: "ea",
  FLAT: "flat",
  CUBIC_YD: "cu yd",
  GALLON: "gal",
};

/** PNG data URL produced by the signature canvas (contractor settings and customer acceptance). */
export const signatureDataUrlSchema = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Invalid signature image")
  .max(400_000, "Signature image too large");
