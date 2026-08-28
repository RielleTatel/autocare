import { fieldTheme, familyForRole } from "./index";
import { fontAssets } from "./fonts";
import { typeScale } from "@autocare/design-tokens";

const ROLES = Object.keys(typeScale) as Array<keyof typeof typeScale>;

describe("field theme", () => {
  it("enforces 56dp gloved targets (NFR-027)", () => {
    expect(fieldTheme.minTarget).toBeGreaterThanOrEqual(56);
  });
  it("scales type up one step from member sizes", () => {
    expect(fieldTheme.text("body").fontSize).toBe(18);
  });
});

describe("fieldTheme.text", () => {
  it("resolves every type-scale role to a registered font family", () => {
    for (const role of ROLES) {
      const family = fieldTheme.text(role).fontFamily as string;
      expect(Object.keys(fontAssets)).toContain(family);
    }
  });

  it("never emits fontWeight — RN mis-synthesises it against a named family", () => {
    for (const role of ROLES) {
      expect(fieldTheme.text(role)).not.toHaveProperty("fontWeight");
    }
  });

  it("scales every role by the 1.125 field step", () => {
    expect(fieldTheme.text("h1").fontSize).toBe(32);
    expect(fieldTheme.text("h2").fontSize).toBe(25);
    expect(fieldTheme.text("body").fontSize).toBe(18);
    expect(fieldTheme.text("label").fontSize).toBe(15);
  });

  it("reaches the emphasis weight without inventing a size", () => {
    expect(familyForRole("body", 600)).toBe("Inter_600SemiBold");
    expect(fieldTheme.text("body", 600).fontSize).toBe(fieldTheme.text("body").fontSize);
  });

  it("enforces the 56dp gloved touch target", () => {
    expect(fieldTheme.minTarget).toBe(56);
  });
});
