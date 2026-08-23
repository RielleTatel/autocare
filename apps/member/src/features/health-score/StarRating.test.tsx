import { render, screen } from "@testing-library/react-native";
import { StarRating } from "./StarRating";

describe("StarRating (FR-114)", () => {
  it("renders the §11.5 star count per band", () => {
    const cases: Array<[number, number]> = [[95, 5], [80, 4], [69, 3], [45, 2], [20, 1]];
    for (const [score, stars] of cases) {
      const { unmount } = render(<StarRating score={score} />);
      expect(screen.getByLabelText(new RegExp(`${stars} out of 5 stars`))).toBeTruthy();
      // filled star count matches
      expect(screen.getAllByTestId(/star-\d-filled/)).toHaveLength(stars);
      unmount();
    }
  });

  it("stars track the capped score — 69 (FAIR) shows 3 stars, not 4", () => {
    render(<StarRating score={69} band="FAIR" />);
    expect(screen.getAllByTestId(/star-\d-filled/)).toHaveLength(3);
  });

  it("exposes a screen-reader label with count and band", () => {
    render(<StarRating score={90} band="EXCELLENT" />);
    expect(screen.getByLabelText("5 out of 5 stars — Excellent")).toBeTruthy();
  });
});
