/**
 * Pure money math for estimates. Runs in the browser (live preview) and on the
 * server (persisted totals) — both must agree, so there is exactly one implementation.
 * All amounts are plain numbers in major units (dollars); rounding happens per line and per total.
 */

export type DiscountType = "PERCENT" | "FIXED";

export interface LineInput {
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  isOptional?: boolean;
}

export interface EstimateInput {
  lines: LineInput[];
  discountType?: DiscountType | null;
  discountValue?: number | null;
  taxRate: number; // 0.0825
  depositType?: DiscountType | null;
  depositValue?: number | null;
}

export interface EstimateTotals {
  lineTotals: number[];
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(line: LineInput): number {
  return round2(line.quantity * line.unitPrice);
}

export function computeTotals(input: EstimateInput): EstimateTotals {
  const active = input.lines.filter((l) => !l.isOptional);
  const lineTotals = input.lines.map(lineTotal);

  const subtotal = round2(active.reduce((s, l) => s + lineTotal(l), 0));

  let discountAmount = 0;
  if (input.discountType === "PERCENT" && input.discountValue) {
    discountAmount = round2(subtotal * (input.discountValue / 100));
  } else if (input.discountType === "FIXED" && input.discountValue) {
    discountAmount = round2(Math.min(input.discountValue, subtotal));
  }

  // Discount is applied proportionally across lines, so tax only hits the taxable share
  const taxableGross = active.filter((l) => l.taxable).reduce((s, l) => s + lineTotal(l), 0);
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  const taxableBase = round2(taxableGross * (1 - discountRatio));
  const taxAmount = round2(taxableBase * input.taxRate);

  const total = round2(subtotal - discountAmount + taxAmount);

  let depositAmount = 0;
  if (input.depositType === "PERCENT" && input.depositValue) {
    depositAmount = round2(total * (input.depositValue / 100));
  } else if (input.depositType === "FIXED" && input.depositValue) {
    depositAmount = round2(Math.min(input.depositValue, total));
  }

  return { lineTotals, subtotal, discountAmount, taxableBase, taxAmount, total, depositAmount };
}

export function formatMoney(amount: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}
