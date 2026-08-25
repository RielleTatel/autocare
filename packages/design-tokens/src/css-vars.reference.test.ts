import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toCssVars } from "./css-vars";

/** The design-system `tokens/colors.css` is a hand-authored derivative of the
 *  token package. It uses a `band-attention` shorthand where the repo's source
 *  of truth (tokens.ts) uses `band-needs-attention`, so we guard *values*, not
 *  var names: every literal colour declared in the reference's light :root block
 *  must appear somewhere in the generated stylesheet. This catches value drift —
 *  the real risk — without coupling to the derivative's alternate spelling. */
const ref = readFileSync(
  resolve(__dirname, "../../../.claude/skills/autocare-plus-design/tokens/colors.css"),
  "utf8",
);
const lightRef = ref.slice(0, ref.indexOf('[data-theme="dark"]'));
const hexValues = [...new Set([...lightRef.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase()))];

describe("generated CSS carries every reference colour value", () => {
  const css = toCssVars().toUpperCase();
  it("has at least the full neutral/brand/band palette", () => {
    expect(hexValues.length).toBeGreaterThanOrEqual(20);
  });
  it.each(hexValues)("contains %s", (hex) => {
    expect(css).toContain(hex);
  });
});
