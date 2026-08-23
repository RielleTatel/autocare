import { approvableTotal, approvedTotal, canTransition, requiredWasteTypes, TRANSITIONS, WoItem, WoStatus } from "./lifecycle";

const THRESHOLD = 150_000; // ₱1,500 (BR-07 default)

function item(partial: Partial<WoItem> = {}): WoItem {
  return {
    type: "PART", qty: 1, unitPriceCentavos: 100_000, discountCentavos: 0,
    approvalStatus: "PENDING", done: false, partCategory: null, ...partial,
  };
}

const ALL: WoStatus[] = ["DRAFT", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "QC", "READY", "CLOSED", "CANCELLED"];

describe("work-order transition table", () => {
  it("every state has an explicit (possibly empty) transition set", () => {
    for (const s of ALL) expect(TRANSITIONS[s]).toBeDefined();
    expect(TRANSITIONS.CLOSED).toEqual([]);
    expect(TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("rejects illegal transitions exhaustively", () => {
    const ctx = { items: [], thresholdCentavos: THRESHOLD };
    for (const from of ALL) {
      for (const to of ALL) {
        const allowed = TRANSITIONS[from].includes(to);
        const result = canTransition(from, to, ctx);
        if (!allowed) expect(result).toEqual({ code: "ILLEGAL_TRANSITION" });
      }
    }
  });

  it("cancel is only reachable from DRAFT and AWAITING_APPROVAL", () => {
    for (const from of ALL) {
      const canCancel = TRANSITIONS[from].includes("CANCELLED");
      expect(canCancel).toBe(from === "DRAFT" || from === "AWAITING_APPROVAL");
    }
  });
});

describe("approvableTotal / approvedTotal", () => {
  it("approvable counts PENDING + APPROVED net of discount; approved counts APPROVED only", () => {
    const items = [
      item({ approvalStatus: "PENDING", qty: 2, unitPriceCentavos: 50_000, discountCentavos: 10_000 }), // 90k
      item({ approvalStatus: "APPROVED", qty: 1, unitPriceCentavos: 60_000 }), // 60k
      item({ approvalStatus: "DECLINED", qty: 1, unitPriceCentavos: 99_000 }), // excluded
      item({ approvalStatus: "DEFERRED", qty: 1, unitPriceCentavos: 99_000 }), // excluded
    ];
    expect(approvableTotal(items)).toBe(150_000);
    expect(approvedTotal(items)).toBe(60_000);
  });

  it("never goes negative when a discount exceeds the line total", () => {
    expect(approvableTotal([item({ qty: 1, unitPriceCentavos: 10_000, discountCentavos: 99_000 })])).toBe(0);
  });
});

describe("DRAFT→APPROVED threshold guard (BR-07)", () => {
  const base = { thresholdCentavos: THRESHOLD, technicianSummary: null, recordedWasteTypes: [] };
  it("allows straight-to-APPROVED at exactly the threshold", () => {
    const items = [item({ unitPriceCentavos: 150_000 })];
    expect(canTransition("DRAFT", "APPROVED", { ...base, items })).toBeNull();
  });
  it("requires approval at threshold + 1 centavo", () => {
    const items = [item({ unitPriceCentavos: 150_001 })];
    expect(canTransition("DRAFT", "APPROVED", { ...base, items })).toEqual({ code: "APPROVAL_REQUIRED" });
  });
  it("AWAITING_APPROVAL→APPROVED is blocked while any line is still PENDING", () => {
    const items = [item({ approvalStatus: "APPROVED" }), item({ approvalStatus: "PENDING" })];
    expect(canTransition("AWAITING_APPROVAL", "APPROVED", { ...base, items })).toEqual({ code: "UNDECIDED_LINES" });
  });
  it("AWAITING_APPROVAL→APPROVED allowed once every line is decided", () => {
    const items = [item({ approvalStatus: "APPROVED" }), item({ approvalStatus: "DECLINED" })];
    expect(canTransition("AWAITING_APPROVAL", "APPROVED", { ...base, items })).toBeNull();
  });
});

describe("closure blockers", () => {
  const summary = "Replaced front pads, road-tested.";
  it("blocks closure when an APPROVED line is not done", () => {
    const items = [item({ approvalStatus: "APPROVED", done: false })];
    expect(canTransition("READY", "CLOSED", { items, thresholdCentavos: THRESHOLD, technicianSummary: summary, recordedWasteTypes: [] }))
      .toEqual({ code: "APPROVED_WORK_INCOMPLETE" });
  });
  it("blocks closure with no technician summary", () => {
    const items = [item({ approvalStatus: "APPROVED", done: true })];
    expect(canTransition("READY", "CLOSED", { items, thresholdCentavos: THRESHOLD, technicianSummary: "  ", recordedWasteTypes: [] }))
      .toEqual({ code: "SUMMARY_REQUIRED" });
  });
  it("an oil-change line demands a USED_OIL waste record before closure", () => {
    const items = [item({ approvalStatus: "APPROVED", done: true, partCategory: "OIL" })];
    expect(canTransition("READY", "CLOSED", { items, thresholdCentavos: THRESHOLD, technicianSummary: summary, recordedWasteTypes: [] }))
      .toEqual({ code: "WASTE_REQUIRED", wasteType: "USED_OIL" });
    expect(canTransition("READY", "CLOSED", { items, thresholdCentavos: THRESHOLD, technicianSummary: summary, recordedWasteTypes: ["USED_OIL"] }))
      .toBeNull();
  });
  it("declined oil line imposes no waste requirement", () => {
    const items = [item({ approvalStatus: "DECLINED", done: false, partCategory: "OIL" })];
    expect(canTransition("READY", "CLOSED", { items, thresholdCentavos: THRESHOLD, technicianSummary: summary, recordedWasteTypes: [] }))
      .toBeNull();
  });
  it("requiredWasteTypes lists the waste demanded by approved part lines", () => {
    const items = [
      item({ approvalStatus: "APPROVED", partCategory: "OIL" }),
      item({ approvalStatus: "APPROVED", partCategory: "BATTERY" }),
      item({ approvalStatus: "DECLINED", partCategory: "TIRE" }),
      item({ type: "LABOR", approvalStatus: "APPROVED", partCategory: null }),
    ];
    expect(requiredWasteTypes(items).sort()).toEqual(["BATTERY", "USED_OIL"]);
  });
});
