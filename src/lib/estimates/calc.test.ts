import { describe, expect, it } from "vitest";
import { computeTotals, formatMoney, lineTotal, round2 } from "./calc";

const line = (quantity: number, unitPrice: number, opts: { taxable?: boolean; isOptional?: boolean } = {}) => ({
  quantity,
  unitPrice,
  taxable: opts.taxable ?? true,
  isOptional: opts.isOptional ?? false,
});

describe("round2", () => {
  it("rounds half-cents up and avoids float drift", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe("lineTotal", () => {
  it("multiplies and rounds per line", () => {
    expect(lineTotal(line(3, 19.99))).toBe(59.97);
    expect(lineTotal(line(1.5, 33.333))).toBe(50);
  });
});

describe("computeTotals", () => {
  it("sums lines with no discount, tax or deposit", () => {
    const t = computeTotals({ lines: [line(2, 100), line(1, 50.5)], taxRate: 0 });
    expect(t).toEqual({
      lineTotals: [200, 50.5],
      subtotal: 250.5,
      discountAmount: 0,
      taxableBase: 250.5,
      taxAmount: 0,
      total: 250.5,
      depositAmount: 0,
    });
  });

  it("applies sales tax only to taxable lines", () => {
    const t = computeTotals({ lines: [line(1, 100, { taxable: true }), line(1, 100, { taxable: false })], taxRate: 0.0825 });
    expect(t.subtotal).toBe(200);
    expect(t.taxableBase).toBe(100);
    expect(t.taxAmount).toBe(8.25);
    expect(t.total).toBe(208.25);
  });

  it("excludes optional lines from every total but still reports their line total", () => {
    const t = computeTotals({ lines: [line(1, 100), line(1, 500, { isOptional: true })], taxRate: 0.1 });
    expect(t.lineTotals).toEqual([100, 500]);
    expect(t.subtotal).toBe(100);
    expect(t.taxableBase).toBe(100);
    expect(t.total).toBe(110);
  });

  it("applies a percent discount and taxes the discounted taxable share", () => {
    // 1000 subtotal, 10% off → 900; only 600 of the 1000 is taxable → base 540 → tax 54
    const t = computeTotals({
      lines: [line(1, 600, { taxable: true }), line(1, 400, { taxable: false })],
      discountType: "PERCENT",
      discountValue: 10,
      taxRate: 0.1,
    });
    expect(t.discountAmount).toBe(100);
    expect(t.taxableBase).toBe(540);
    expect(t.taxAmount).toBe(54);
    expect(t.total).toBe(954);
  });

  it("applies a fixed discount proportionally to the taxable base", () => {
    // 200 subtotal, $50 off → ratio 0.25; taxable 100 → base 75
    const t = computeTotals({
      lines: [line(1, 100, { taxable: true }), line(1, 100, { taxable: false })],
      discountType: "FIXED",
      discountValue: 50,
      taxRate: 0.08,
    });
    expect(t.discountAmount).toBe(50);
    expect(t.taxableBase).toBe(75);
    expect(t.taxAmount).toBe(6);
    expect(t.total).toBe(156);
  });

  it("caps a fixed discount at the subtotal so the total never goes negative", () => {
    const t = computeTotals({ lines: [line(1, 80)], discountType: "FIXED", discountValue: 500, taxRate: 0.1 });
    expect(t.discountAmount).toBe(80);
    expect(t.taxableBase).toBe(0);
    expect(t.total).toBe(0);
  });

  it("ignores a discount type without a value (and vice versa)", () => {
    expect(computeTotals({ lines: [line(1, 100)], discountType: "PERCENT", discountValue: null, taxRate: 0 }).discountAmount).toBe(0);
    expect(computeTotals({ lines: [line(1, 100)], discountType: "PERCENT", discountValue: 0, taxRate: 0 }).discountAmount).toBe(0);
    expect(computeTotals({ lines: [line(1, 100)], discountType: null, discountValue: 10, taxRate: 0 }).discountAmount).toBe(0);
  });

  it("computes a percent deposit on the final total (after tax)", () => {
    const t = computeTotals({ lines: [line(1, 1000)], taxRate: 0.1, depositType: "PERCENT", depositValue: 30 });
    expect(t.total).toBe(1100);
    expect(t.depositAmount).toBe(330);
  });

  it("caps a fixed deposit at the total", () => {
    const t = computeTotals({ lines: [line(1, 100)], taxRate: 0, depositType: "FIXED", depositValue: 250 });
    expect(t.depositAmount).toBe(100);
    expect(computeTotals({ lines: [line(1, 100)], taxRate: 0, depositType: "FIXED", depositValue: 40 }).depositAmount).toBe(40);
  });

  it("handles an empty estimate without dividing by zero", () => {
    const t = computeTotals({ lines: [], discountType: "PERCENT", discountValue: 10, taxRate: 0.1, depositType: "PERCENT", depositValue: 50 });
    expect(t).toEqual({ lineTotals: [], subtotal: 0, discountAmount: 0, taxableBase: 0, taxAmount: 0, total: 0, depositAmount: 0 });
  });

  it("keeps cents exact on a realistic mixed estimate", () => {
    // Exterior repaint: labor (non-taxable), materials (taxable), optional upsell
    const t = computeTotals({
      lines: [
        line(24, 65, { taxable: false }), // 1560 labor
        line(12, 48.75, { taxable: true }), // 585 materials
        line(1, 350, { isOptional: true }), // optional
      ],
      discountType: "PERCENT",
      discountValue: 5,
      taxRate: 0.0825,
      depositType: "PERCENT",
      depositValue: 25,
    });
    expect(t.subtotal).toBe(2145);
    expect(t.discountAmount).toBe(107.25);
    expect(t.taxableBase).toBe(555.75);
    expect(t.taxAmount).toBe(45.85);
    expect(t.total).toBe(2083.6);
    expect(t.depositAmount).toBe(520.9);
  });
});

describe("change orders", () => {
  it("nets credits (negative rates) against extras and taxes the net", () => {
    const t = computeTotals({
      lines: [
        { quantity: 1, unitPrice: 800, taxable: true }, // extra: exhaust fan
        { quantity: 1, unitPrice: -300, taxable: true }, // credit: removed scope
      ],
      taxRate: 0.1,
    });
    expect(t.subtotal).toBe(500);
    expect(t.taxAmount).toBe(50);
    expect(t.total).toBe(550);
  });

  it("can be a pure credit with a negative total", () => {
    const t = computeTotals({ lines: [{ quantity: 2, unitPrice: -125.5, taxable: false }], taxRate: 0.0825 });
    expect(t.subtotal).toBe(-251);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(-251);
  });
});

describe("formatMoney", () => {
  it("formats USD by default and honors other currency/locale pairs", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(1234.5, "CAD", "en-CA")).toBe("$1,234.50");
    // ICU emits a non-breaking space before the symbol
    expect(formatMoney(1234.5, "EUR", "pt-PT").replace(/\s/g, " ")).toBe("1234,50 €");
  });
});
