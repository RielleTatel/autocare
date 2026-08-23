import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UtilisationWidget } from "./UtilisationWidget";

describe("UtilisationWidget", () => {
  it("marks a breaching day and not a healthy one", () => {
    render(
      <UtilisationWidget
        days={[
          { date: "2027-07-01", booked: 2, available: 10, ratio: 0.2 },
          { date: "2027-07-02", booked: 9, available: 10, ratio: 0.9 },
        ]}
      />,
    );
    expect(screen.getByTestId("bar-2027-07-01").getAttribute("data-breach")).toBe("0");
    expect(screen.getByTestId("bar-2027-07-02").getAttribute("data-breach")).toBe("1");
  });

  it("renders an empty state", () => {
    render(<UtilisationWidget days={[]} />);
    expect(screen.getByText(/no data/i)).toBeDefined();
  });
});
