import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandChip, starsForBand, bandVar } from "./BandChip";

describe("BandChip", () => {
  it("names the band in words, not the enum", () => {
    render(<BandChip band="NEEDS_ATTENTION" />);
    expect(screen.getByText("Needs Attention")).toBeTruthy();
  });

  it("uses the protected band token, never a raw hex", () => {
    expect(bandVar("CRITICAL")).toBe("var(--ac-band-critical)");
    expect(bandVar("FAIR")).toBe("var(--ac-band-fair)");
  });

  it("maps each band to its star count", () => {
    expect(starsForBand("EXCELLENT")).toBe(5);
    expect(starsForBand("GOOD")).toBe(4);
    expect(starsForBand("FAIR")).toBe(3);
    expect(starsForBand("NEEDS_ATTENTION")).toBe(2);
    expect(starsForBand("CRITICAL")).toBe(1);
  });
});
