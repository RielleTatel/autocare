import { render, screen } from "@testing-library/react";
import { Plate } from "./Plate";

describe("Plate", () => {
  it("renders mono chip variant", () => {
    render(<Plate variant="chip">ABC 1234</Plate>);
    const el = screen.getByText("ABC 1234");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("bg-primary-deep");
  });
});
