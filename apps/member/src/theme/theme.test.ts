import { theme } from "./index";

describe("member theme", () => {
  it("maps rem type scale to RN px", () => {
    expect(theme.text("body").fontSize).toBe(16);
    expect(theme.text("score").fontSize).toBe(72);
  });
  it("uses token colors", () => {
    expect(theme.colors.primary).toBe("#0E5AA7");
  });
  it("meets member tap target minimum", () => {
    expect(theme.minTarget).toBeGreaterThanOrEqual(48);
  });
});
