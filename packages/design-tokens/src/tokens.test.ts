import { describe, expect, it } from "vitest";
import { colors, vhsBands, targets, contrastRatio, elevation, motion, borders, radii } from "./tokens";

describe("extended tokens", () => {
  it("exposes hairline-first elevation with a sheet shadow", () => {
    expect(elevation.flat).toBe("none");
    expect(elevation.sheet).toContain("rgba(22, 35, 46, 0.16)");
    expect(elevation.scrim).toBe("rgba(22, 35, 46, 0.4)");
  });
  it("exposes motion durations and standard easing", () => {
    expect(motion.durFast).toBe("140ms");
    expect(motion.easeStandard).toBe("cubic-bezier(0.2, 0, 0.2, 1)");
    expect(motion.pressOpacity).toBe(0.82);
  });
  it("exposes border widths and a pill radius", () => {
    expect(borders.control).toBe(1.5);
    expect(borders.gaugeStroke).toBe(18);
    expect(radii.pill).toBe(999);
  });
});

describe("design tokens", () => {
  it("body text on surfaces meets WCAG AA 4.5:1 (NFR-028)", () => {
    expect(contrastRatio(colors.ink, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.ink, colors.chassis)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.inkMuted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
  it("every VHS band chip passes 3:1 for large text/graphics", () => {
    for (const band of Object.values(vhsBands)) {
      expect(contrastRatio(band.on, band.fill)).toBeGreaterThanOrEqual(3);
    }
  });
  it("field targets exceed member targets (NFR-027)", () => {
    expect(targets.fieldMinDp).toBeGreaterThanOrEqual(56);
    expect(targets.memberMinDp).toBeGreaterThanOrEqual(48);
  });
});
