import { render, screen } from "@testing-library/react-native";
import { ScoreGauge } from "./ScoreGauge";
import { vhsBands } from "@autocare/design-tokens";

describe("ScoreGauge", () => {
  it("maps each score to its band color and label", () => {
    const cases: Array<[number, keyof typeof vhsBands]> = [
      [95, "EXCELLENT"],
      [80, "GOOD"],
      [69, "FAIR"],
      [45, "NEEDS_ATTENTION"],
      [20, "CRITICAL"],
    ];
    for (const [score, bandKey] of cases) {
      const { unmount } = render(<ScoreGauge score={score} />);
      expect(screen.getByTestId("gauge-score")).toHaveTextContent(String(score));
      expect(screen.getByTestId("gauge-band")).toHaveTextContent(vhsBands[bandKey].labelEn);
      const progress = screen.getByTestId("gauge-progress");
      expect(progress.props.accessibilityLabel).toBe(vhsBands[bandKey].fill);
      unmount();
    }
  });

  it("renders a stale variant with grey arc and inspected-days caption", () => {
    render(<ScoreGauge score={82} isStale daysSinceInspection={124} />);
    expect(screen.getByTestId("gauge-stale")).toHaveTextContent("Inspected 124 days ago");
    // grey arc, not the band color
    expect(screen.getByTestId("gauge-progress").props.accessibilityLabel).not.toBe(vhsBands.GOOD.fill);
  });

  it("exposes an accessible score label", () => {
    render(<ScoreGauge score={69} band="FAIR" />);
    expect(screen.getByLabelText(/69 out of 100, Fair/)).toBeTruthy();
  });

  it("shows a confidence chip when not stale", () => {
    render(<ScoreGauge score={90} confidence="HIGH" />);
    expect(screen.getByText("High confidence")).toBeTruthy();
  });
});
