import { validateVehicleForm, emptyVehicleForm } from "./vehicleForm";

describe("vehicle form", () => {
  it("maps schema issues to per-field errors", () => {
    const r = validateVehicleForm({ ...emptyVehicleForm, plateNo: "1234ABC", year: "2019", odometerKm: "42000",
      make: "Toyota", model: "Vios", fuelType: "GASOLINE", transmission: "AT" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.plateNo).toMatch(/plate/i);
  });
  it("coerces numeric strings and returns a valid payload", () => {
    const r = validateVehicleForm({ ...emptyVehicleForm, plateNo: "ABA 1234", year: "2019", odometerKm: "42000",
      make: "Toyota", model: "Vios", fuelType: "GASOLINE", transmission: "AT" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.plateNo).toBe("ABA1234"); expect(r.data.year).toBe(2019); }
  });
});
