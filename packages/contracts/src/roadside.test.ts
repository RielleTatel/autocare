import { describe, expect, it } from "vitest";
import { roadsideRequestSchema, roadsideStatusSchema, incidentTypes, roadsideStatuses } from "./roadside";

describe("roadside contracts", () => {
  it("accepts a request with coordinates and an incident type", () => {
    const r = roadsideRequestSchema.parse({
      vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
      incidentType: "FLAT_TYRE",
      lat: 6.9214,
      lng: 122.079,
      address: "Governor Camins Ave, Zamboanga City",
      landmarkNote: "Beside the blue gate",
    });
    expect(r.incidentType).toBe("FLAT_TYRE");
  });

  it("allows a request with no address when geocoding fails, as long as a landmark is given", () => {
    const r = roadsideRequestSchema.parse({
      vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
      incidentType: "OTHER",
      lat: 6.9214,
      lng: 122.079,
      landmarkNote: "Opposite the covered court",
    });
    expect(r.address).toBeUndefined();
  });

  it("rejects coordinates outside the valid range", () => {
    expect(() =>
      roadsideRequestSchema.parse({
        vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
        incidentType: "FLAT_TYRE",
        lat: 200,
        lng: 0,
      }),
    ).toThrow();
  });

  it("covers every incident type the spec lists (FR-033)", () => {
    expect([...incidentTypes]).toEqual([
      "FLAT_TYRE",
      "DEAD_BATTERY",
      "OUT_OF_FUEL",
      "OVERHEATING",
      "WILL_NOT_START",
      "ACCIDENT",
      "OTHER",
    ]);
  });

  it("covers the six-state lifecycle (FR-038)", () => {
    expect([...roadsideStatuses]).toEqual([
      "REQUESTED",
      "ACKNOWLEDGED",
      "DISPATCHED",
      "EN_ROUTE",
      "ON_SITE",
      "RESOLVED",
    ]);
  });

  it("rejects a status transition payload with an unknown status", () => {
    expect(() => roadsideStatusSchema.parse({ status: "LOST" })).toThrow();
  });
});
