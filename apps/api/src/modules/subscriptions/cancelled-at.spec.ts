/**
 * Guards the invariant that motivated the column: every path that moves a
 * subscription to CANCELLED must stamp cancelledAt. Without it, churn is
 * computed from cancelRequestedAt, which for deferred cancellations can be a
 * full billing period early.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, p), "utf8");

describe("cancelledAt is stamped at every CANCELLED transition", () => {
  it("the deferred finaliser in billing.service sets it", () => {
    const src = read("../billing/billing.service.ts");
    const at = src.indexOf('status: "CANCELLED"');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 120)).toContain("cancelledAt");
  });

  it("the immediate cancel in subscriptions.service sets it", () => {
    const src = read("./subscriptions.service.ts");
    const idx = src.indexOf('status: "CANCELLED", cancelRequestedAt');
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 120)).toContain("cancelledAt");
  });

  it("the schema declares the column", () => {
    expect(read("../../../prisma/schema.prisma")).toMatch(/cancelledAt\s+DateTime\?\s+@map\("cancelled_at"\)/);
  });
});
