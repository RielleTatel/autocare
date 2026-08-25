import { describe, expect, it } from "vitest";
import { toCssVars } from "./css-vars";

describe("toCssVars", () => {
  const css = toCssVars();
  it("emits neutrals, brand, and band fill+text", () => {
    expect(css).toContain("--ac-ink: #16232E;");
    expect(css).toContain("--ac-primary: #0E5AA7;");
    expect(css).toContain("--ac-band-excellent: #177245;");
    expect(css).toContain("--ac-band-excellent-text: #0F5C37;");
  });
  it("emits spacing, radii, targets and borders", () => {
    expect(css).toContain("--ac-space-md: 16px;");
    expect(css).toContain("--ac-radius-pill: 999px;");
    expect(css).toContain("--ac-target-field: 56px;");
    expect(css).toContain("--ac-border-control: 1.5px;");
  });
  it("emits semantic aliases and motion", () => {
    expect(css).toContain("--text-primary: var(--ac-ink);");
    expect(css).toContain("--action-primary: var(--ac-primary);");
    expect(css).toContain("--ac-duration-fast: 140ms;");
    expect(css).toContain("--ac-ease-standard: cubic-bezier(0.2, 0, 0.2, 1);");
  });
  it("emits a dark block overriding neutrals but not band fills", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(dark).toContain("--ac-chassis: #101820;");
    expect(dark).toContain("--ac-primary: #4C95DB;");
    expect(dark).not.toContain("--ac-band-excellent:");
  });
});
