import { fireEvent, render, screen } from "@testing-library/react-native";
import { PointEntryScreen } from "./PointEntryScreen";
import type { ConfigPoint } from "@autocare/scoring";

const statusPoint: ConfigPoint = {
  code: "DISC", label: "Brake discs", labelFil: "Brake disc", weightInCategory: 50,
  isSafetyCritical: true, inputType: "STATUS", recommendation: "machine", requiresPhotoOnAdverse: true,
};
const measuredPoint: ConfigPoint = {
  code: "PAD", label: "Front pads", weightInCategory: 50, isSafetyCritical: true, inputType: "MEASURED",
  unit: "mm", thresholds: { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 },
  recommendation: "replace", requiresPhotoOnAdverse: true,
};

const noop = () => undefined;

describe("PointEntryScreen (F-06)", () => {
  it("renders all five status chips at gloved-target height", () => {
    render(<PointEntryScreen point={statusPoint} onSave={noop} onAddPhoto={noop} onNext={noop} />);
    for (const label of ["Good", "Monitor", "Attention", "Critical", "N/A"]) {
      const chip = screen.getByLabelText(label);
      expect(chip.props.style.minHeight).toBeGreaterThanOrEqual(56);
    }
  });

  it("measured point shows numeric input + unit and a live derived chip matching deriveStatus", () => {
    render(<PointEntryScreen point={measuredPoint} onSave={noop} onAddPhoto={noop} onNext={noop} />);
    const input = screen.getByLabelText("Front pads measured value");
    fireEvent.changeText(input, "3.0");
    expect(screen.getByTestId("derived-status-chip")).toHaveTextContent("Attention");
    fireEvent.changeText(input, "7.5");
    expect(screen.getByTestId("derived-status-chip")).toHaveTextContent("Good");
  });

  it("adverse selection with requiresPhotoOnAdverse shows a blocking add-photo affordance", () => {
    const onAddPhoto = jest.fn();
    render(<PointEntryScreen point={statusPoint} onSave={noop} onAddPhoto={onAddPhoto} onNext={noop} />);
    expect(screen.queryByLabelText("Add photo (required)")).toBeNull();
    fireEvent.press(screen.getByLabelText("Attention"));
    const photoBtn = screen.getByLabelText("Add photo (required)");
    fireEvent.press(photoBtn);
    expect(onAddPhoto).toHaveBeenCalled();
    // Save is blocked while the photo is missing
    const save = screen.getByLabelText("Save and next");
    expect(save.props.accessibilityState.disabled).toBe(true);
  });

  it("fires the adverse haptic hook and saves the chosen result", () => {
    const onSave = jest.fn();
    const onNext = jest.fn();
    const haptic = jest.fn();
    render(<PointEntryScreen point={statusPoint} initial={{ pointCode: "DISC", photoUris: ["file://p.jpg"] }} onSave={onSave} onAddPhoto={noop} onNext={onNext} onAdverseHaptic={haptic} />);
    fireEvent.press(screen.getByLabelText("Critical"));
    expect(haptic).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Save and next"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pointCode: "DISC", status: "CRITICAL", photoUris: ["file://p.jpg"] }));
    expect(onNext).toHaveBeenCalled();
  });

  it("has a notes field", () => {
    render(<PointEntryScreen point={statusPoint} onSave={noop} onAddPhoto={noop} onNext={noop} />);
    expect(screen.getByLabelText("Notes")).toBeTruthy();
  });

  it("confirms an attached photo so the mechanic knows it took", () => {
    render(
      <PointEntryScreen
        point={measuredPoint}
        initial={{ pointCode: "PAD", status: "ATTENTION", photoUris: ["file:///a.jpg"] }}
        onSave={noop}
        onAddPhoto={noop}
        onNext={noop}
      />,
    );
    expect(screen.getByText("1 photo attached")).toBeTruthy();
  });
});
