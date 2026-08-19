import { describe, expect, it } from "vitest";
import { colors, vhsBands, targets, contrastRatio } from "./tokens";

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
