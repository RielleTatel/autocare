import { upgradePreviewText, downgradePreviewText, etfSummaryText, requiresEtfAcceptance, newIdempotencyKey } from "./billingPreview";

describe("upgradePreviewText", () => {
  it("states the pro-rated charge amount", () => {
    expect(upgradePreviewText(25000)).toMatch(/₱250\.00/);
    expect(upgradePreviewText(25000)).toMatch(/now/i);
  });
});

describe("downgradePreviewText", () => {
  it("states the effective date and that there's no charge today", () => {
    const text = downgradePreviewText("2026-09-15T00:00:00Z");
    expect(text).toMatch(/September 15, 2026/);
    expect(text).toMatch(/No charge today/i);
  });
});

describe("etfSummaryText", () => {
  it("states the ETF amount and lock-in end date when inside lock-in", () => {
    const text = etfSummaryText(50000, "2026-12-01T00:00:00Z");
    expect(text).toMatch(/₱500\.00/);
    expect(text).toMatch(/December 1, 2026/);
  });
  it("says there's no fee when outside lock-in", () => {
    const text = etfSummaryText(0, "2026-01-01T00:00:00Z");
    expect(text).toMatch(/no early termination fee/i);
  });
});

describe("requiresEtfAcceptance", () => {
  it("is true when the ETF is positive", () => {
    expect(requiresEtfAcceptance(1)).toBe(true);
  });
  it("is false when the ETF is zero", () => {
    expect(requiresEtfAcceptance(0)).toBe(false);
  });
});

describe("newIdempotencyKey", () => {
  it("generates distinct keys per call", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
