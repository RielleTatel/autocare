import type { WorkOrderItem } from "./api";

export const VAT_RATE = 0.12;

export interface QuoteTotals {
  partsCentavos: number;
  laborCentavos: number;
  discountCentavos: number;
  netCentavos: number;
  vatCentavos: number;
  grandTotalCentavos: number;
  approvedCentavos: number;
}

const lineTotal = (i: Pick<WorkOrderItem, "qty" | "unitPriceCentavos" | "discountCentavos">) =>
  Math.max(0, i.qty * i.unitPriceCentavos - i.discountCentavos);

/** Pure quote maths for the W-06 totals panel. Prices are VAT-inclusive
 *  (PH retail convention), so VAT is shown as the tax component backed out of
 *  the net, not added on top. */
export function quoteTotals(items: WorkOrderItem[]): QuoteTotals {
  const parts = items.filter((i) => i.type === "PART").reduce((s, i) => s + lineTotal(i), 0);
  const labor = items.filter((i) => i.type === "LABOR").reduce((s, i) => s + lineTotal(i), 0);
  const discount = items.reduce((s, i) => s + i.discountCentavos, 0);
  const net = parts + labor;
  const vat = Math.round(net - net / (1 + VAT_RATE));
  const approved = items.filter((i) => i.approvalStatus === "APPROVED").reduce((s, i) => s + lineTotal(i), 0);
  return {
    partsCentavos: parts,
    laborCentavos: labor,
    discountCentavos: discount,
    netCentavos: net,
    vatCentavos: vat,
    grandTotalCentavos: net,
    approvedCentavos: approved,
  };
}
