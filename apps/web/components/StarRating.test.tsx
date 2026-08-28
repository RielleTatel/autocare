import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "./StarRating";

describe("StarRating", () => {
  it("states the rating in text for assistive tech", () => {
    render(<StarRating band="GOOD" />);
    expect(screen.getByLabelText("4 out of 5 stars")).toBeTruthy();
  });

  it("draws five stars regardless of the score", () => {
    const { container } = render(<StarRating band="CRITICAL" />);
    expect(container.querySelectorAll("svg").length).toBe(5);
  });
});
