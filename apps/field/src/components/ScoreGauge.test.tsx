import { render, screen } from "@testing-library/react-native";
import { ScoreGauge } from "./ScoreGauge";

describe("ScoreGauge", () => {
  it("shows the score and its band", () => {
    render(<ScoreGauge score={69} />);
    expect(screen.getByText("69")).toBeTruthy();
    expect(screen.getByText(/Fair/)).toBeTruthy();
  });

  it("clamps out-of-range scores rather than drawing past the arc", () => {
    render(<ScoreGauge score={140} />);
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("states confidence when the inspection was partial", () => {
    render(<ScoreGauge score={69} confidence="MEDIUM" />);
    expect(screen.getByText(/MEDIUM confidence/)).toBeTruthy();
  });
});
