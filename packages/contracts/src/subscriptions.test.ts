import { describe, expect, it } from "vitest";
import {
  subscriptionCreateSchema, subscriptionUpgradeSchema, subscriptionDowngradeSchema, subscriptionCancelSchema,
} from "./subscriptions";

const uuid = "11111111-1111-1111-1111-111111111111";

describe("subscription contracts", () => {
  it("accepts a valid create payload", () => {
    const parsed = subscriptionCreateSchema.parse({ vehicleId: uuid, planId: uuid, paymentMethod: "E_PAYMENT" });
    expect(parsed.paymentMethod).toBe("E_PAYMENT");
  });
  it("rejects an invalid payment method", () => {
    expect(() => subscriptionCreateSchema.parse({ vehicleId: uuid, planId: uuid, paymentMethod: "CASH" })).toThrow();
  });
  it("rejects a non-uuid vehicleId", () => {
    expect(() => subscriptionCreateSchema.parse({ vehicleId: "nope", planId: uuid, paymentMethod: "COD" })).toThrow();
  });
  it("upgrade/downgrade schemas require a uuid planId", () => {
    expect(subscriptionUpgradeSchema.parse({ planId: uuid })).toEqual({ planId: uuid });
    expect(subscriptionDowngradeSchema.parse({ planId: uuid })).toEqual({ planId: uuid });
    expect(() => subscriptionUpgradeSchema.parse({ planId: "x" })).toThrow();
  });
  it("cancel schema: acceptEtf is optional and boolean", () => {
    expect(subscriptionCancelSchema.parse({})).toEqual({});
    expect(subscriptionCancelSchema.parse({ acceptEtf: true })).toEqual({ acceptEtf: true });
    expect(() => subscriptionCancelSchema.parse({ acceptEtf: "yes" })).toThrow();
  });
});
