import { render, screen } from "@testing-library/react-native";
import { ScoreResultScreen } from "./ScoreResultScreen";

const result = {
  score: 69,
  band: "FAIR" as const,
  overrideApplied: "SAFETY_CRITICAL",
  averagedScore: 84.5,
  confidence: "MEDIUM" as const,
  topDetractors: [
    { label: "Front brake pad replacement", status: "CRITICAL" as const, recommendation: "Replace the pads", estimatedCostCentavos: 320000 },
  ],
};

describe("ScoreResultScreen", () => {
  it("explains a capped score with the numbers behind it", () => {
    render(<ScoreResultScreen result={result} />);
    expect(screen.getByText(/Averaged 84.5 · capped at 69/)).toBeTruthy();
  });

  it("prices each recommendation so the advisor can quote it", () => {
    render(<ScoreResultScreen result={result} />);
    expect(screen.getByText("est. ₱3,200")).toBeTruthy();
  });

  it("waits for the score rather than showing a wrong one", () => {
    render(<ScoreResultScreen offline />);
    expect(screen.getByText(/Score will appear once this device syncs/)).toBeTruthy();
  });
});
