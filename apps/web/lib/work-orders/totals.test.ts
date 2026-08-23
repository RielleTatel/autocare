import { describe, expect, it } from "vitest";
import { quoteTotals } from "./totals";
import type { WorkOrderItem } from "./api";

function item(partial: Partial<WorkOrderItem>): WorkOrderItem {
  return {
    id: crypto.randomUUID(), type: "PART", partSku: null, partName: null, stockQty: null,
    description: "x", qty: 1, unitPriceCentavos: 0, discountCentavos: 0, lineTotalCentavos: 0,
    approvalStatus: "PENDING", recommendationId: null, recommendationLabel: null, severity: null, done: false,
    ...partial,
  };
}

describe("quoteTotals — worked-example quote (front pads + labour)", () => {
  const items = [
    item({ type: "PART", partSku: "BRK-PAD-FR-STD", description: "Front brake pads", qty: 1, unitPriceCentavos: 155000 }),
    item({ type: "LABOR", description: "Brake service labour", qty: 1, unitPriceCentavos: 80000 }),
  ];

  it("sums parts and labour separately", () => {
    const t = quoteTotals(items);
    expect(t.partsCentavos).toBe(155000);
    expect(t.laborCentavos).toBe(80000);
    expect(t.grandTotalCentavos).toBe(235000); // ₱2,350.00
  });

  it("backs VAT out of the VAT-inclusive total (12%)", () => {
    const t = quoteTotals(items);
    // 235000 - 235000/1.12 = 25178.57 → 25179
    expect(t.vatCentavos).toBe(25179);
  });

  it("applies per-line discounts and never goes negative", () => {
    const discounted = [
      item({ type: "PART", qty: 2, unitPriceCentavos: 50000, discountCentavos: 10000 }), // 90000
      item({ type: "PART", qty: 1, unitPriceCentavos: 10000, discountCentavos: 99000 }), // clamps to 0
    ];
    const t = quoteTotals(discounted);
    expect(t.partsCentavos).toBe(90000);
    expect(t.discountCentavos).toBe(109000);
  });

  it("tracks the approved subtotal separately from the quoted total", () => {
    const mixed = [
      item({ type: "PART", qty: 1, unitPriceCentavos: 155000, approvalStatus: "APPROVED" }),
      item({ type: "LABOR", qty: 1, unitPriceCentavos: 80000, approvalStatus: "DECLINED" }),
    ];
    const t = quoteTotals(mixed);
    expect(t.grandTotalCentavos).toBe(235000);
    expect(t.approvedCentavos).toBe(155000);
  });
});
