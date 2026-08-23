import { describe, expect, it } from "vitest";
import { vhsBands } from "@autocare/design-tokens";
import type { Band } from "./types";

// The engine re-declares the band union to stay dependency-free; this test
// pins it to the design-tokens `vhsBands` keys so they can never drift.
type TokenBand = keyof typeof vhsBands;
type AssertSame<A, B> = A extends B ? (B extends A ? true : never) : never;
const bandsMatchTokens: AssertSame<Band, TokenBand> = true;

describe("band union vs design tokens", () => {
  it("engine Band union matches vhsBands keys", () => {
    expect(bandsMatchTokens).toBe(true);
    expect(Object.keys(vhsBands).sort()).toEqual(
      (["EXCELLENT", "GOOD", "FAIR", "NEEDS_ATTENTION", "CRITICAL"] as Band[]).sort(),
    );
  });
});
