import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children with roomy padding", () => {
    render(<Card pad="lg">Inside</Card>);
    const el = screen.getByText("Inside");
    expect(el.className).toContain("p-6");
  });
  it("draws a left accent edge when accent is set", () => {
    render(<Card accent="var(--ac-sev-critical)">Warn</Card>);
    expect(screen.getByText("Warn")).toHaveStyle({ borderLeft: "5px solid var(--ac-sev-critical)" });
  });
});
