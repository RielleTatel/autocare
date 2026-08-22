import { describe, expect, it } from "vitest";
import { planCreateSchema, planUpdateSchema, planEntitlementSchema } from "./plans";

const entitlement = { entitlementType: "INSPECTION", quantityPerCycle: 2, overagePriceCentavos: 5000 };

describe("plan contracts", () => {
  it("accepts a valid create payload", () => {
    const parsed = planCreateSchema.parse({
      code: "BASIC", name: "Basic Plan", priceCentavos: 99900,
      billingInterval: "MONTHLY", lockInMonths: 6, entitlements: [entitlement],
    });
    expect(parsed.entitlements).toHaveLength(1);
  });
  it("rejects non-integer money", () => {
    expect(() => planCreateSchema.parse({
      code: "BASIC", name: "Basic Plan", priceCentavos: 999.5,
      billingInterval: "MONTHLY", lockInMonths: 6, entitlements: [entitlement],
    })).toThrow();
  });
  it("rejects negative entitlement quantities", () => {
    expect(() => planEntitlementSchema.parse({ ...entitlement, quantityPerCycle: -1 })).toThrow();
  });
  it("update schema allows a partial payload", () => {
    expect(planUpdateSchema.parse({ name: "Renamed" })).toEqual({ name: "Renamed" });
    expect(planUpdateSchema.parse({})).toEqual({});
  });
});
