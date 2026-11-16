import { fitVehicleCameraDistance } from "./vehicleCameraFit.mjs";

describe("vehicle camera fitting", () => {
  it("backs away for the narrow canvas inside a 320dp screen", () => {
    expect(fitVehicleCameraDistance(240, 340)).toBeGreaterThan(fitVehicleCameraDistance(430, 340));
  });

  it("uses the same framing for the same aspect at different pixel densities", () => {
    expect(fitVehicleCameraDistance(240, 340)).toBeCloseTo(fitVehicleCameraDistance(720, 1020));
  });

  it("has a finite initial fit before a usable layout is available", () => {
    const fallback = fitVehicleCameraDistance(1, 1);
    expect(fitVehicleCameraDistance(0, 0)).toBe(fallback);
    expect(fitVehicleCameraDistance(NaN, 340)).toBe(fallback);
    expect(Number.isFinite(fallback)).toBe(true);
  });
});
