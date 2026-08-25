import { describe, expect, it } from "vitest";
import { tailwindPreset } from "./tailwind-preset";

const ext = tailwindPreset.theme.extend as any;

describe("tailwind preset", () => {
  it("exposes the spacing scale", () => {
    expect(ext.spacing.md).toBe("16px");
    expect(ext.spacing.xxl).toBe("48px");
  });
  it("exposes pill radius and elevation shadows", () => {
    expect(ext.borderRadius.pill).toBe("999px");
    expect(ext.boxShadow.sheet).toContain("rgba(22, 35, 46, 0.16)");
  });
  it("exposes band text colors alongside fills", () => {
    expect(ext.colors.band.excellent).toBe("#177245");
    expect(ext.colors.band["excellent-text"]).toBe("#0F5C37");
  });
});
