import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows an error heading in danger tone", () => {
    render(<EmptyState tone="error" title="Could not load" body="Try again." />);
    expect(screen.getByText("Could not load").className).toContain("text-danger");
  });
  it("renders skeleton bars when loading", () => {
    const { container } = render(<EmptyState tone="loading" title="Loading" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(3);
  });
});
