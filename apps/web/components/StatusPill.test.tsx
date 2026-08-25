import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders content in a mono pill", () => {
    render(<StatusPill tone="success">SETTLED</StatusPill>);
    const el = screen.getByText("SETTLED");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("rounded-pill");
  });
  it("applies the solidDeep tone", () => {
    render(<StatusPill tone="solidDeep">CHROME</StatusPill>);
    expect(screen.getByText("CHROME").className).toContain("bg-primary-deep");
  });
});
