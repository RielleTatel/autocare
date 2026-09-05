import { render, screen, fireEvent } from "@testing-library/react-native";
import { DiagramZoneSheet } from "./DiagramZoneSheet";

const results = [
  { pointCode: "ENGINE_IDLE", label: "Engine idle quality", diagramZone: "ENGINE_BAY", status: "MONITOR", categoryCode: "ENGINE" },
  { pointCode: "BATTERY_VOLTAGE", label: "Battery voltage", diagramZone: "ENGINE_BAY", status: "GOOD", categoryCode: "BATTERY" },
  { pointCode: "TREAD_FL", label: "Front-left tyre tread", diagramZone: "WHEEL_FL", status: "CRITICAL", categoryCode: "TYRES" },
] as any;

describe("DiagramZoneSheet", () => {
  it("lists only the points in the tapped shape", () => {
    render(<DiagramZoneSheet shapeId="ENGINE_BAY" results={results} onClose={jest.fn()} />);
    expect(screen.getByText("Engine idle quality")).toBeTruthy();
    expect(screen.getByText("Battery voltage")).toBeTruthy();
    expect(screen.queryByText("Front-left tyre tread")).toBeNull();
  });

  it("includes points reaching a wheel through an axle or corners-all zone", () => {
    const withAxle = [
      ...results,
      { pointCode: "BRAKE_PAD_FRONT", label: "Front brake pads", diagramZone: "AXLE_FRONT", status: "ATTENTION", categoryCode: "BRAKES" },
      { pointCode: "SHOCKS", label: "Shock absorbers", diagramZone: "CORNERS_ALL", status: "GOOD", categoryCode: "SUSP" },
    ] as any;
    render(<DiagramZoneSheet shapeId="WHEEL_FL" results={withAxle} onClose={jest.fn()} />);
    expect(screen.getByText("Front-left tyre tread")).toBeTruthy();
    expect(screen.getByText("Front brake pads")).toBeTruthy();
    expect(screen.getByText("Shock absorbers")).toBeTruthy();
  });

  it("renders nothing when no shape is selected", () => {
    const { toJSON } = render(<DiagramZoneSheet shapeId={null} results={results} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("reports the selected point", () => {
    const onSelectPoint = jest.fn();
    render(<DiagramZoneSheet shapeId="ENGINE_BAY" results={results} onClose={jest.fn()} onSelectPoint={onSelectPoint} />);
    fireEvent.press(screen.getByTestId("zone-point-ENGINE_IDLE"));
    expect(onSelectPoint).toHaveBeenCalledWith(expect.objectContaining({ pointCode: "ENGINE_IDLE" }));
  });

  it("explains an empty zone rather than showing a blank sheet", () => {
    render(<DiagramZoneSheet shapeId="UNDERBODY" results={results} onClose={jest.fn()} />);
    expect(screen.getByText(/nothing was recorded/i)).toBeTruthy();
  });
});
