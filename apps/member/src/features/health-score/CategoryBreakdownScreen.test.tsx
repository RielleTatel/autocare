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
    diagramZone: "AXLE_FRONT",
    status: "ATTENTION", measuredValue: 3, unit: "mm",
    thresholds: { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 },
    templates: { ATTENTION: "{component} needs attention soon ({measured} {unit})." },
    recommendation: "Replace pads", isSafetyCritical: true, notes: null, photoUrls: [],
  },
  {
    pointCode: "HEADLIGHTS", label: "Headlights", labelFil: null, categoryId: "c2", categoryCode: "LIGHTS",
    diagramZone: "LIGHTS_FRONT",
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

it("explains null status as unavailable and retains measured status resolution", () => {
  render(<CategoryBreakdownScreen score={score} results={[
    { ...results[0], status: null },
    { ...results[1], status: null },
  ]} />);
  fireEvent.press(screen.getByLabelText("Show Brakes components"));
  fireEvent.press(screen.getByLabelText(/Front brake pads, Needs attention/));
  expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/needs attention/);
  fireEvent.press(screen.getByLabelText("Got it"));
  fireEvent.press(screen.getByLabelText("Show Lights components"));
  fireEvent.press(screen.getByLabelText(/Headlights, Status unavailable/));
  expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/does not provide a usable status/);
});

it("offers retry when findings fail without hiding category scores", () => {
  const retry = jest.fn();
  render(<CategoryBreakdownScreen score={score} resultsError="Inspection findings could not be loaded. Please retry." onRetryResults={retry} />);
  expect(screen.getByTestId("bar-BRAKES")).toBeTruthy();
  fireEvent.press(screen.getByText("Retry findings"));
  expect(retry).toHaveBeenCalledTimes(1);
});
