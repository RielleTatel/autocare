import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBar } from "./CategoryBar";

describe("CategoryBar", () => {
  it("labels the category and its score", () => {
    render(<CategoryBar label="Brakes" score={55} />);
    expect(screen.getByText("Brakes")).toBeTruthy();
    expect(screen.getByText("55")).toBeTruthy();
  });

  it("exposes the score as a progress value", () => {
    render(<CategoryBar label="Brakes" score={55} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("55");
  });

  it("clamps a score outside 0-100 rather than overflowing its track", () => {
    render(<CategoryBar label="Engine" score={140} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });
});
