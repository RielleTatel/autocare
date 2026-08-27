import { render, screen } from "@testing-library/react-native";
import { HealthScoreScreen } from "./HealthScoreScreen";
import type { HealthScore } from "./healthScoreApi";

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
});
