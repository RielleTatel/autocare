import { serviceIcon, serviceTint } from "./serviceIcon";
import { vhsBands, colors, contrastRatio } from "@autocare/design-tokens";

/** The codes seeded by apps/api/prisma/seed-scheduling.ts. */
const SEEDED: [string, string][] = [
  ["OIL_CHANGE", "Oil Change"],
  ["TIRE_ROTATION", "Tire Rotation"],
  ["BRAKE_SERVICE", "Brake Service"],
  ["AC_SERVICE", "A/C Service"],
  ["FULL_INSPECTION", "Full Inspection"],
];

describe("serviceIcon", () => {
  // The regression this exists for: the map was keyed on a mockup's invented
  // codes, so every real service fell through to the same fallback wrench and
  // the list read as five identical rows.
  it("gives every seeded service its own glyph", () => {
    const icons = SEEDED.map(([code, name]) => serviceIcon(code, name));
    expect(new Set(icons).size).toBe(SEEDED.length);
    expect(icons).not.toContain("wrench");
  });

  it("matches the seeded codes exactly", () => {
    expect(serviceIcon("OIL_CHANGE", "Oil Change")).toBe("droplet");
    expect(serviceIcon("BRAKE_SERVICE", "Brake Service")).toBe("disc");
    expect(serviceIcon("AC_SERVICE", "A/C Service")).toBe("snowflake");
  });

  // Service types are admin-created rows, so codes this build has never seen
  // still have to arrive with something better than a wrench.
  it("reads an unknown service from its wording", () => {
    expect(serviceIcon("BATTERY_REPLACEMENT", "Battery replacement")).toBe("battery");
    expect(serviceIcon("WHEEL_ALIGNMENT", "Wheel alignment")).toBe("rotate-cw");
    expect(serviceIcon("CABIN_FILTER", "Cabin air filter")).toBe("wind");
    expect(serviceIcon("DETAILING", "Interior detailing")).toBe("sparkles");
  });

  it("reads a service from its name when the code is opaque", () => {
    expect(serviceIcon("SVC-0042", "Brake pad replacement")).toBe("disc");
  });

  // "Brake fluid" is a brake job, not a fluid change — first keyword wins.
  it("prefers the more specific keyword when two could match", () => {
    expect(serviceIcon("BRAKE_FLUID", "Brake fluid flush")).toBe("disc");
  });

  it("falls back to a wrench for a service it has no vocabulary for", () => {
    expect(serviceIcon("XYZ", "Bespoke fabrication")).toBe("wrench");
  });
});

describe("serviceTint", () => {
  const ALL = [
    ...SEEDED.map(([code, name]) => serviceIcon(code, name)),
    serviceIcon("BATTERY", "Battery"),
    serviceIcon("ELECTRICAL", "Alternator"),
    serviceIcon("FILTER", "Cabin air filter"),
    serviceIcon("TUNE", "Engine tune-up"),
    serviceIcon("DETAIL", "Detailing"),
    serviceIcon("ODO", "Odometer calibration"),
    serviceIcon("XYZ", "Bespoke fabrication"),
  ];

  // WCAG 1.4.11: a meaningful graphic needs 3:1 against its own background.
  it("keeps every glyph legible on its tile", () => {
    for (const icon of ALL) {
      const { bg, fg } = serviceTint(icon);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3);
    }
  });

  // Principle 1: band colours mean a score or an inspection status. A service
  // tile tinted anywhere near a band fill would make brand decoration
  // indistinguishable from product data.
  it("keeps every tint clear of the protected band scale and the brand red", () => {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const distance = (a: string, b: string) =>
      channels(a).reduce((sum, c, i) => sum + Math.abs(c - channels(b)[i]), 0);
    const reserved = [...Object.values(vhsBands).map((b) => b.fill), colors.primary, colors.danger];

    for (const icon of ALL) {
      const { fg } = serviceTint(icon);
      for (const taken of reserved) {
        expect(distance(fg, taken)).toBeGreaterThan(80);
      }
    }
  });
});
