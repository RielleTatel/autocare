import { fireEvent, render, screen } from "@testing-library/react-native";
import { ExplainSheet, type ExplainTarget } from "./ExplainSheet";
import type { ExplainPoint } from "@autocare/scoring";

const battery: ExplainPoint = {
  code: "BATTERY_VOLTAGE",
  label: "Battery voltage",
  unit: "V",
  thresholds: { direction: "HIGHER_BETTER", good: 12.6, monitor: 12.4, attention: 12.0 },
  templates: {
    GOOD: "{component} is in good condition ({measured} {unit}). No action needed.",
    MONITOR: "{component} is serviceable, but {measured} {unit} is near the limit of {threshold} {unit}. Have it monitored.",
  },
};

describe("ExplainSheet (FR-115)", () => {
  it("renders nothing when no target is set", () => {
    render(<ExplainSheet target={null} onClose={() => undefined} />);
    expect(screen.queryByTestId("explain-sentence")).toBeNull();
  });

  it("opens for a healthy (GOOD) component with its no-action-needed sentence", () => {
    const target: ExplainTarget = { point: battery, status: "GOOD", measuredValue: 12.8 };
    render(<ExplainSheet target={target} onClose={() => undefined} />);
    expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/in good condition/);
    expect(screen.getByLabelText(/out of 5 stars/)).toBeTruthy();
  });

  it("shows the templated MONITOR sentence with measured vs threshold", () => {
    const target: ExplainTarget = { point: battery, status: "MONITOR", measuredValue: 12.4 };
    render(<ExplainSheet target={target} onClose={() => undefined} />);
    expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/12\.4 V is near the limit of 12\.6 V/);
    expect(screen.getByText(/Measured 12.4 V/)).toBeTruthy();
  });

  it("explains a NOT_APPLICABLE component without stars", () => {
    const target: ExplainTarget = { point: battery, status: "NOT_APPLICABLE" };
    render(<ExplainSheet target={target} onClose={() => undefined} />);
    expect(screen.getByTestId("explain-sentence")).toHaveTextContent(/does not apply/);
    expect(screen.queryByLabelText(/out of 5 stars/)).toBeNull();
  });

  it("calls onClose from the Got it button", () => {
    const onClose = jest.fn();
    render(<ExplainSheet target={{ point: battery, status: "GOOD", measuredValue: 12.8 }} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
