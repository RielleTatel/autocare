import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeVHS } from "./engine";
import { seedConfig } from "./seed-config";

const dir = join(__dirname, "..", "fixtures");
describe("golden fixtures", () => {
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  it("has at least 30 fixtures (NFR-039)", () => expect(files.length).toBeGreaterThanOrEqual(30));
  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const out = computeVHS({ results: fx.results, daysSinceInspection: fx.daysSinceInspection }, fx.config ?? seedConfig);
      expect(out).toMatchObject(fx.expected);
    });
  }
});

describe("reproducibility (NFR-055)", () => {
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  it("computeVHS is deterministic on every fixture", () => {
    for (const f of files) {
      const fx = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const input = { results: fx.results, daysSinceInspection: fx.daysSinceInspection };
      const a = computeVHS(input, fx.config ?? seedConfig);
      const b = computeVHS(input, fx.config ?? seedConfig);
      expect(a).toEqual(b);
    }
  });
  it("output shape of the worked example is pinned (snapshot)", () => {
    const fx = JSON.parse(readFileSync(join(dir, "01-worked-example.json"), "utf8"));
    const out = computeVHS({ results: fx.results, daysSinceInspection: fx.daysSinceInspection }, fx.config);
    expect(JSON.stringify(out, null, 2)).toMatchSnapshot();
  });
});
