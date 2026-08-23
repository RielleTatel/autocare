import { describe, it, expect } from "vitest";
import { slotQuerySchema, holdCreateSchema, appointmentCreateSchema, rescheduleSchema } from "./scheduling";

describe("scheduling contracts", () => {
  it("accepts a valid slot query", () => {
    const p = slotQuerySchema.parse({ from: "2026-09-01", to: "2026-09-07", serviceTypeId: "11111111-1111-1111-1111-111111111111" });
    expect(p.from).toBe("2026-09-01");
  });
  it("rejects a slot window wider than 30 days", () => {
    expect(() =>
      slotQuerySchema.parse({ from: "2026-09-01", to: "2026-10-15", serviceTypeId: "11111111-1111-1111-1111-111111111111" }),
    ).toThrow();
  });
  it("requires an ISO start on a hold", () => {
    expect(() => holdCreateSchema.parse({ bayId: "x", start: "nope", serviceTypeId: "y" })).toThrow();
  });
  it("accepts an appointment create with a hold id", () => {
    const p = appointmentCreateSchema.parse({
      holdId: "bay1|2026-09-01T09:00:00+08:00",
      vehicleId: "11111111-1111-1111-1111-111111111111",
      serviceTypeId: "22222222-2222-2222-2222-222222222222",
      requiresPickup: false,
    });
    expect(p.requiresPickup).toBe(false);
  });
  it("reschedule requires a new hold id", () => {
    expect(() => rescheduleSchema.parse({})).toThrow();
  });
});
