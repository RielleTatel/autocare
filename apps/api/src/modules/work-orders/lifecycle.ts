/** Pure work-order lifecycle (FR-070). No I/O — the service wraps this with
 *  persistence. Kept separate so the transition table and guards are exhaustively
 *  unit-testable without a DB. */

export type WoStatus =
  | "DRAFT" | "AWAITING_APPROVAL" | "APPROVED" | "IN_PROGRESS" | "QC" | "READY" | "CLOSED" | "CANCELLED";

export type ItemApproval = "PENDING" | "APPROVED" | "DECLINED" | "DEFERRED";
export type ItemType = "PART" | "LABOR";

export interface WoItem {
  type: ItemType;
  qty: number;
  unitPriceCentavos: number;
  discountCentavos: number;
  approvalStatus: ItemApproval;
  done: boolean;
  partCategory?: string | null;
}

export const TRANSITIONS: Record<WoStatus, WoStatus[]> = {
  DRAFT: ["AWAITING_APPROVAL", "APPROVED", "CANCELLED"], // →APPROVED only if total ≤ threshold
  AWAITING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["QC"],
  QC: ["READY", "IN_PROGRESS"],
  READY: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

/** Net total of the lines that count toward the approval threshold: PENDING +
 *  APPROVED lines, each `qty*unitPrice - discount`. Declined/deferred excluded. */
export function approvableTotal(items: WoItem[]): number {
  return items
    .filter((i) => i.approvalStatus === "PENDING" || i.approvalStatus === "APPROVED")
    .reduce((sum, i) => sum + Math.max(0, i.qty * i.unitPriceCentavos - i.discountCentavos), 0);
}

/** Billable total at closure: APPROVED lines only, net of discount. */
export function approvedTotal(items: WoItem[]): number {
  return items
    .filter((i) => i.approvalStatus === "APPROVED")
    .reduce((sum, i) => sum + Math.max(0, i.qty * i.unitPriceCentavos - i.discountCentavos), 0);
}

export type TransitionError =
  | { code: "ILLEGAL_TRANSITION" }
  | { code: "APPROVAL_REQUIRED" }
  | { code: "UNDECIDED_LINES" }
  | { code: "APPROVED_WORK_INCOMPLETE" }
  | { code: "SUMMARY_REQUIRED" }
  | { code: "WASTE_REQUIRED"; wasteType: string };

export interface TransitionContext {
  items: WoItem[];
  thresholdCentavos: number;
  technicianSummary?: string | null;
  /** Waste types already recorded on the work order. */
  recordedWasteTypes?: string[];
}

/** Part categories that mandate a waste record before closure (C-08 groundwork). */
const WASTE_FOR_CATEGORY: Record<string, string> = {
  OIL: "USED_OIL",
  FILTER: "FILTER",
  BATTERY: "BATTERY",
  TIRE: "TIRE",
  FLUID: "COOLANT",
};

/** Returns null when the transition is allowed, else the blocking reason. */
export function canTransition(from: WoStatus, to: WoStatus, ctx: TransitionContext): TransitionError | null {
  if (!TRANSITIONS[from].includes(to)) return { code: "ILLEGAL_TRANSITION" };

  if (to === "APPROVED" && from === "DRAFT") {
    if (approvableTotal(ctx.items) > ctx.thresholdCentavos) return { code: "APPROVAL_REQUIRED" };
  }

  if (to === "APPROVED" && from === "AWAITING_APPROVAL") {
    // Every line must be decided (no PENDING left) before work is approved (FR-067/068).
    if (ctx.items.some((i) => i.approvalStatus === "PENDING")) return { code: "UNDECIDED_LINES" };
  }

  if (to === "CLOSED") {
    const approved = ctx.items.filter((i) => i.approvalStatus === "APPROVED");
    if (approved.some((i) => !i.done)) return { code: "APPROVED_WORK_INCOMPLETE" };
    if (!ctx.technicianSummary || ctx.technicianSummary.trim() === "") return { code: "SUMMARY_REQUIRED" };
    const recorded = new Set(ctx.recordedWasteTypes ?? []);
    for (const item of approved) {
      if (item.type !== "PART" || !item.partCategory) continue;
      const required = WASTE_FOR_CATEGORY[item.partCategory];
      if (required && !recorded.has(required)) return { code: "WASTE_REQUIRED", wasteType: required };
    }
  }

  return null;
}

export function requiredWasteTypes(items: WoItem[]): string[] {
  const out = new Set<string>();
  for (const i of items) {
    if (i.approvalStatus === "APPROVED" && i.type === "PART" && i.partCategory) {
      const w = WASTE_FOR_CATEGORY[i.partCategory];
      if (w) out.add(w);
    }
  }
  return [...out];
}
