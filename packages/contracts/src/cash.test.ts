import { describe, expect, it } from "vitest";
import { cashShiftCloseSchema, cashPaymentSchema } from "./cash";

describe("cash contracts", () => {
  it("accepts a valid shift-close payload", () => {
    expect(cashShiftCloseSchema.parse({ countedCentavos: 150000 })).toEqual({ countedCentavos: 150000 });
  });
  it("rejects a negative counted amount", () => {
    expect(() => cashShiftCloseSchema.parse({ countedCentavos: -1 })).toThrow();
  });
  it("accepts a valid cash-payment payload", () => {
    const dto = { invoiceId: "11111111-1111-1111-1111-111111111111", amountTendered: 100000, clientUuid: "22222222-2222-2222-2222-222222222222" };
    expect(cashPaymentSchema.parse(dto)).toEqual(dto);
  });
  it("rejects a non-uuid clientUuid", () => {
    expect(() => cashPaymentSchema.parse({ invoiceId: "11111111-1111-1111-1111-111111111111", amountTendered: 100000, clientUuid: "not-a-uuid" })).toThrow();
  });
  it("rejects non-integer money", () => {
    expect(() => cashPaymentSchema.parse({ invoiceId: "11111111-1111-1111-1111-111111111111", amountTendered: 999.5, clientUuid: "22222222-2222-2222-2222-222222222222" })).toThrow();
  });
});
