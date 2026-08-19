import { fieldTheme } from "./index";
describe("field theme", () => {
  it("enforces 56dp gloved targets (NFR-027)", () => {
    expect(fieldTheme.minTarget).toBeGreaterThanOrEqual(56);
  });
  it("scales type up one step from member sizes", () => {
    expect(fieldTheme.text("body").fontSize).toBe(18);
  });
});
