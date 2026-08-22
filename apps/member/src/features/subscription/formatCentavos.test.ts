import { formatCentavos } from "./formatCentavos";

describe("formatCentavos", () => {
  it("formats whole pesos", () => {
    expect(formatCentavos(150000)).toBe("₱1500.00");
  });
  it("formats a fractional peso amount", () => {
    expect(formatCentavos(12345)).toBe("₱123.45");
  });
  it("formats zero", () => {
    expect(formatCentavos(0)).toBe("₱0.00");
  });
  it("rounds sub-centavo remainders like toFixed", () => {
    expect(formatCentavos(1)).toBe("₱0.01");
  });
});
