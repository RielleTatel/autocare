import { theme, familyForRole } from "./index";
import { fontAssets } from "./fonts";

describe("member theme", () => {
  it("maps rem type scale to RN px", () => {
    expect(theme.text("body").fontSize).toBe(16);
    expect(theme.text("score").fontSize).toBe(72);
  });

  // A fontFamily naming a face that was never passed to useFonts does not throw
  // — RN silently falls back to the system font, which is exactly the bug that
  // made every screen render off-brand. Pin the mapping in both directions.
  it("resolves every type-scale role to a face that is actually loaded", () => {
    const roles = ["score", "h1", "h2", "body", "label", "code"] as const;
    for (const role of roles) {
      expect(Object.keys(fontAssets)).toContain(familyForRole(role));
    }
  });

  it("puts the three brand faces on the right roles", () => {
    expect(familyForRole("h1")).toBe("BarlowSemiCondensed_600SemiBold");
    expect(familyForRole("body")).toBe("Inter_400Regular");
    expect(familyForRole("label")).toBe("Inter_500Medium");
    expect(familyForRole("code")).toBe("IBMPlexMono_500Medium");
  });

  // The weight lives in the family name; emitting fontWeight too makes Android
  // pick a synthesised face over the real one.
  it("never emits fontWeight alongside a custom family", () => {
    expect(theme.text("h1").fontWeight).toBeUndefined();
  });
  it("uses token colors", () => {
    expect(theme.colors.primary).toBe("#D9273F");
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
