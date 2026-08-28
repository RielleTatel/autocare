import { normalisedMonthlyCentavos, mrrCentavos, churnRate, CONTRACTED_STATUSES } from "./metrics";

describe("normalisedMonthlyCentavos", () => {
  it("passes monthly through untouched", () => {
    expect(normalisedMonthlyCentavos(149900n, "MONTHLY")).toBe(149900n);
  });

  it("divides quarterly by three", () => {
    expect(normalisedMonthlyCentavos(450000n, "QUARTERLY")).toBe(150000n);
  });

  it("divides annual by twelve", () => {
    expect(normalisedMonthlyCentavos(1800000n, "ANNUAL")).toBe(150000n);
  });

  it("rounds to the nearest centavo rather than truncating", () => {
    // 100000 / 3 = 33333.33 → 33333; 200000 / 3 = 66666.67 → 66667
    expect(normalisedMonthlyCentavos(100000n, "QUARTERLY")).toBe(33333n);
    expect(normalisedMonthlyCentavos(200000n, "QUARTERLY")).toBe(66667n);
  });
});

describe("mrrCentavos", () => {
  it("sums a mixed book onto a monthly basis", () => {
    const total = mrrCentavos([
      { priceCentavos: 149900n, interval: "MONTHLY" },
      { priceCentavos: 450000n, interval: "QUARTERLY" },
      { priceCentavos: 1800000n, interval: "ANNUAL" },
    ]);
    expect(total).toBe(149900n + 150000n + 150000n);
  });

  it("is zero for an empty book", () => {
    expect(mrrCentavos([])).toBe(0n);
  });
});

describe("churnRate", () => {
  it("is cancellations over the opening population", () => {
    expect(churnRate(3, 150)).toBeCloseTo(0.02, 5);
  });

  it("is zero when nobody was contracted at the window start", () => {
    expect(churnRate(0, 0)).toBe(0);
  });

  it("does not divide by zero when cancellations exist but the opening count is zero", () => {
    expect(churnRate(2, 0)).toBe(0);
  });
});

describe("CONTRACTED_STATUSES", () => {
  it("counts members who are late but still under contract", () => {
    expect([...CONTRACTED_STATUSES].sort()).toEqual(["ACTIVE", "GRACE", "PAST_DUE"]);
  });
});
