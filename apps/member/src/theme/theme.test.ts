import { theme } from "./index";

describe("member theme", () => {
  it("maps rem type scale to RN px", () => {
    expect(theme.text("body").fontSize).toBe(16);
    expect(theme.text("score").fontSize).toBe(72);
  });
  it("uses token colors", () => {
    expect(theme.colors.primary).toBe("#0E5AA7");
  });
  it("meets member tap target minimum", () => {
    expect(theme.minTarget).toBeGreaterThanOrEqual(48);
  });
  it("exposes elevation, motion, borders, and pill radius", () => {
    expect(theme.elevation.card).toContain("rgba");
    expect(theme.motion.durFast).toBe("140ms");
    expect(theme.borders.control).toBe(1.5);
    expect(theme.radii.pill).toBe(999);
  });
});
