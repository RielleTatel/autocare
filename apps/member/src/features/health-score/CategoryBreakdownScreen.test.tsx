import { fireEvent, render, screen } from "@testing-library/react-native";
import { CategoryBreakdownScreen } from "./CategoryBreakdownScreen";
import type { HealthScore, InspectionResultDetail } from "./healthScoreApi";

const score = {
  categoryScores: [
    { categoryCode: "BRAKES", label: "Brakes", weight: 16, score: 75.8, applicablePoints: 5 },
    { categoryCode: "LIGHTS", label: "Lights", weight: 7, score: 100, applicablePoints: 6 },
  ],
} as unknown as HealthScore;

const results: InspectionResultDetail[] = [
  {
    pointCode: "BRAKE_PAD_FRONT", label: "Front brake pads", labelFil: null, categoryId: "c1", categoryCode: "BRAKES",
    status: "ATTENTION", measuredValue: 3, unit: "mm",
    thresholds: { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 },
    templates: { ATTENTION: "{component} needs attention soon ({measured} {unit})." },
    recommendation: "Replace pads", isSafetyCritical: true, notes: null, photoUrls: [],
  },
  {
    pointCode: "HEADLIGHTS", label: "Headlights", labelFil: null, categoryId: "c2", categoryCode: "LIGHTS",
    status: "GOOD", measuredValue: null, unit: null, thresholds: null,
    templates: { GOOD: "{component} is working correctly. No action needed." },
    recommendation: "", isSafetyCritical: true, notes: null, photoUrls: [],
  },
];

describe("CategoryBreakdownScreen (M-14, FR-115)", () => {
  it("renders a band-colored bar and stars for every category", () => {
    render(<CategoryBreakdownScreen score={score} results={results} />);
    expect(screen.getByTestId("bar-BRAKES")).toBeTruthy();
    expect(screen.getByTestId("bar-LIGHTS")).toBeTruthy();
    // one StarRating per category header
    expect(screen.getAllByLabelText(/out of 5 stars/).length).toBeGreaterThanOrEqual(2);
  });

  it("tapping a category opens an explanation sheet", () => {
    render(<CategoryBreakdownScreen score={score} results={results} />);
    fireEvent.press(screen.getByLabelText(/Brakes, score 76. Tap to explain\./));
    expect(screen.getByTestId("explain-sentence")).toBeTruthy();
  });

  it("tapping a GOOD component still opens a sheet with its no-action-needed sentence (regression)", () => {
    render(<CategoryBreakdownScreen score={score} results={results} />);
    // expand the LIGHTS category to reveal its components
    fireEvent.press(screen.getByLabelText("Show Lights components"));
    fireEvent.press(screen.getByLabelText(/Headlights, Good. Tap to explain\./));
    expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/working correctly/);
  });
});
