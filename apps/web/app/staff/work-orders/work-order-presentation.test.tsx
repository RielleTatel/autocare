import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");

describe("work-order page presentation", () => {
  it("does not shadow the shared StatusPill with a local one", () => {
    expect(src).not.toMatch(/function StatusPill\s*\(/);
    expect(src).toMatch(/from "\.\.\/\.\.\/\.\.\/\.\.\/components\/StatusPill"/);
  });

  it("carries no hardcoded band hexes", () => {
    expect(src).not.toContain("#B3261E");
    expect(src).not.toContain("#C75E1B");
    expect(src).not.toContain("#B87E00");
  });

  it("renders money in the mono face with tabular figures", () => {
    expect(src).toContain("tabular-nums");
  });

  it("uses the Plate primitive for the plate", () => {
    expect(src).toMatch(/from "\.\.\/\.\.\/\.\.\/\.\.\/components\/Plate"/);
  });
});
