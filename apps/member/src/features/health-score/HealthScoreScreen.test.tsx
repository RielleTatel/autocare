jest.mock("./VehicleDiagram3D", () => ({ VehicleDiagram3D: require("./VehicleDiagram").VehicleDiagram }));
import { render, screen, fireEvent } from "@testing-library/react-native";
import { HealthScoreScreen } from "./HealthScoreScreen";
import type { HealthScore, InspectionResultDetail } from "./healthScoreApi";

const results = [
  { pointCode: "ENGINE_IDLE", label: "Engine idle quality", diagramZone: "ENGINE_BAY", status: "MONITOR", categoryCode: "ENGINE" },
] as unknown as InspectionResultDetail[];

const base = {
  score: 69,
  band: "FAIR",
  confidence: "MEDIUM",
  isStale: false,
  computedAt: new Date().toISOString(),
  overrideApplied: "SAFETY_ATTENTION",
  categoryScores: [],
  topDetractors: [
    { pointCode: "BRAKE_PAD_FRONT", label: "Front brake pads", status: "ATTENTION", recommendation: "Replace within 1,000 km." },
    { pointCode: "TYRE_REAR", label: "Rear tyres", status: "MONITOR", recommendation: "Monitor; plan replacement." },
  ],
  recommendations: [],
} as unknown as HealthScore;

describe("HealthScoreScreen (M-13)", () => {
  it("answers 'why this score' in one always-visible card", () => {
    render(<HealthScoreScreen score={base} />);
    // Previously the cap explanation was hidden behind an accordion.
    expect(screen.getByText("Why 69?")).toBeTruthy();
    expect(screen.getByTestId("why-this-score")).toHaveTextContent(/capped at 69/);
  });

  it("lists the detractors that caused the cap inside that same card", () => {
    render(<HealthScoreScreen score={base} />);
    const card = screen.getByTestId("why-this-score");
    expect(card).toHaveTextContent(/Front brake pads — Attention\./);
    expect(card).toHaveTextContent(/Replace within 1,000 km\./);
    expect(card).toHaveTextContent(/Rear tyres — Monitor\./);
  });

  it("says everything checked out when there is nothing to explain", () => {
    const clean = { ...base, score: 92, band: "EXCELLENT", overrideApplied: "NONE", topDetractors: [] } as unknown as HealthScore;
    render(<HealthScoreScreen score={clean} />);
    expect(screen.queryByTestId("why-this-score")).toBeNull();
    expect(screen.getByText("No adverse findings — everything checked out.")).toBeTruthy();
  });

  it("still explains an uncapped score that has findings", () => {
    const uncapped = { ...base, score: 78, overrideApplied: "NONE" } as unknown as HealthScore;
    render(<HealthScoreScreen score={uncapped} />);
    expect(screen.getByText("Why 78?")).toBeTruthy();
    expect(screen.getByTestId("why-this-score")).toHaveTextContent(/Front brake pads/);
  });

  it("offers a diagram toggle when inspection results are available", () => {
    render(<HealthScoreScreen score={base} results={results} />);
    expect(screen.getByTestId("view-toggle-diagram")).toBeTruthy();
  });

  it("hides the toggle when there are no results yet", () => {
    render(<HealthScoreScreen score={base} results={[]} />);
    expect(screen.queryByTestId("view-toggle-diagram")).toBeNull();
  });

  it("shows the diagram after switching to it", async () => {
    render(<HealthScoreScreen score={base} results={results} />);
    fireEvent.press(screen.getByTestId("view-toggle-diagram"));
    expect(await screen.findByTestId("zone-ENGINE_BAY")).toBeTruthy();
  });

  it("keeps the score explanation to the list view", () => {
    render(<HealthScoreScreen score={base} results={results} />);
    expect(screen.getByTestId("why-this-score")).toBeTruthy();
    fireEvent.press(screen.getByTestId("view-toggle-diagram"));
    expect(screen.queryByTestId("why-this-score")).toBeNull();
  });
});


it("explains an unavailable status without calling it not applicable", () => {
  render(<HealthScoreScreen score={base} results={[{ ...results[0], status: null, thresholds: null, measuredValue: null }]} />);
  fireEvent.press(screen.getByTestId("view-toggle-diagram"));
  fireEvent.press(screen.getByTestId("region-ENGINE_BAY"));
  fireEvent.press(screen.getByTestId("zone-point-ENGINE_IDLE"));
  expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/does not provide a usable status/);
});

it("clears an open finding when inspection identity changes", () => {
  const { rerender } = render(<HealthScoreScreen score={{ ...base, inspectionId: "first" }} results={results} />);
  fireEvent.press(screen.getByTestId("view-toggle-diagram"));
  fireEvent.press(screen.getByTestId("region-ENGINE_BAY"));
  fireEvent.press(screen.getByTestId("zone-point-ENGINE_IDLE"));
  expect(screen.getByTestId("explain-sentence")).toBeTruthy();
  rerender(<HealthScoreScreen score={{ ...base, inspectionId: "second" }} results={results} />);
  expect(screen.queryByTestId("explain-sentence")).toBeNull();
});


it("offers findings retry while keeping the score visible after a detail error", () => {
  const retry = jest.fn();
  render(<HealthScoreScreen score={base} resultsError="Inspection findings could not be loaded. Please retry." onRetryResults={retry} />);
  expect(screen.getByText("Why 69?")).toBeTruthy();
  fireEvent.press(screen.getByText("Retry findings"));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("view-toggle-diagram")).toBeNull();
});


it("remembers manual 2D choice when returning from the list during the same screen visit", async () => {
  render(<HealthScoreScreen score={base} results={results} />);
  fireEvent.press(screen.getByTestId("view-toggle-diagram"));
  fireEvent.press(screen.getByLabelText("2D vehicle view"));
  fireEvent.press(screen.getByTestId("view-toggle-list"));
  fireEvent.press(screen.getByTestId("view-toggle-diagram"));
  expect(screen.getByRole("button", { name: "2D vehicle view", selected: true })).toBeTruthy();
});
