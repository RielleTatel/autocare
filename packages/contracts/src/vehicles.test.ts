import { describe, expect, it } from "vitest";
import { vehicleCreateSchema, odometerCreateSchema, normalizePlate } from "./vehicles";

const base = { make: "Toyota", model: "Vios", year: 2019, fuelType: "GASOLINE", transmission: "AT", odometerKm: 42000 };

describe("vehicle contracts", () => {
  it("accepts car plates with or without space, normalized", () => {
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "ABA 1234" }).plateNo).toBe("ABA1234");
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "nbc123" }).plateNo).toBe("NBC123");
  });
  it("accepts motorcycle plates (digits-first)", () => {
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "123 ABC" }).plateNo).toBe("123ABC");
  });
  it("rejects non-LTO patterns", () => {
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "1234ABC" })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "AB 12" })).toThrow();
  });
  it("bounds year to 1970..next year and vin to 11-17 chars", () => {
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", year: 1969 })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", year: new Date().getFullYear() + 2 })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", vin: "SHORT" })).toThrow();
  });
  it("normalizePlate strips whitespace and uppercases", () => {
    expect(normalizePlate(" aba 1234 ")).toBe("ABA1234");
  });
  it("odometer justification is optional but non-trivial when present", () => {
    expect(odometerCreateSchema.parse({ km: 100 }).justification).toBeUndefined();
    expect(() => odometerCreateSchema.parse({ km: 100, justification: "x" })).toThrow();
  });
  it("accepts an optional ISO last-service date", () => {
    const parsed = vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", lastServiceAt: "2026-03-01" });
    expect(parsed.lastServiceAt).toBe("2026-03-01");
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234" }).lastServiceAt).toBeUndefined();
  });

  it("rejects a future last-service date", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", lastServiceAt: future })).toThrow();
  });
});
