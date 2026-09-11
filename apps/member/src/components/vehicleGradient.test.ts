import { vehicleGradient, VEHICLE_FIELDS } from "./vehicleGradient";
import { vhsBands, contrastRatio } from "@autocare/design-tokens";

const ON_DARK_ACCENT = "#FF7A88";
const SUBTITLE = "#E4C9CE";
const STOPS = VEHICLE_FIELDS.flatMap((f) => [f.from, f.to]);

describe("vehicleGradient", () => {
  it("is stable for the same vehicle", () => {
    const id = "9d2f1c44-0000-4000-8000-abcdefabcdef";
    expect(vehicleGradient(id)).toEqual(vehicleGradient(id));
  });

  it("spreads a realistic set of vehicles across the palette", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `veh-${i}-${i * 7919}`);
    const used = new Set(ids.map((id) => vehicleGradient(id).from));
    expect(used.size).toBeGreaterThanOrEqual(4);
  });

  // A shared end stop tinted every card the same way at the bottom, which
  // flattened exactly the difference the per-vehicle colour exists to create.
  it("keeps both stops in one hue family, so cards stay distinguishable", () => {
    for (const { from, to } of VEHICLE_FIELDS) {
      expect(from).not.toBe(to);
      // Same family: the deeper stop is a darker tone, not a different colour.
      expect(contrastRatio(from, to)).toBeLessThan(2);
    }
    const ends = new Set(VEHICLE_FIELDS.map((f) => f.to));
    expect(ends.size).toBe(VEHICLE_FIELDS.length);
  });

  // Every stop is a text background, so this is the guarantee that matters:
  // white body copy and the on-dark accent stay legible whichever colour a
  // vehicle draws, at either end of its gradient.
  it("keeps card text legible on every stop", () => {
    for (const stop of STOPS) {
      expect(contrastRatio("#FFFFFF", stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(SUBTITLE, stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ON_DARK_ACCENT, stop)).toBeGreaterThanOrEqual(3);
    }
  });

  // Principle 1: band colours mean a score. A card field close in tone to a
  // band fill would let the card itself read as a condition.
  it("keeps every stop distinct in tone from the band scale", () => {
    for (const stop of STOPS) {
      for (const band of Object.values(vhsBands)) {
        expect(contrastRatio(stop, band.fill)).toBeGreaterThanOrEqual(1.4);
      }
    }
  });

  // Greens and ambers are the band scale's hues; a forest-green card would
  // quietly suggest "Excellent".
  it("uses no green or amber stop", () => {
    for (const stop of STOPS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(stop.slice(i, i + 2), 16));
      expect(g > r && g > b).toBe(false); // green-dominant
      expect(r > b + 40 && g > b + 40).toBe(false); // amber/olive
    }
  });
});
