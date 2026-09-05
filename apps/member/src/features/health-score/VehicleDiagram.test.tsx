import { render, screen, fireEvent } from "@testing-library/react-native";
import { VehicleDiagram } from "./VehicleDiagram";
import { statusColor } from "./statusColor";

const results = [
  { diagramZone: "WHEEL_FL", status: "CRITICAL" },
  { diagramZone: "ENGINE_BAY", status: "MONITOR" },
] as any;

// react-native-svg normalises a colour prop into { type, payload }, where the
// payload is the colour as opaque ARGB. Compare against that rather than the
// hex string the component actually passes in.
const argb = (hex: string) => 0xff000000 + parseInt(hex.slice(1), 16);
const fillOf = (testID: string) => (screen.getByTestId(testID).props.fill as any).payload;

describe("VehicleDiagram", () => {
  it("renders every shape", () => {
    render(<VehicleDiagram results={results} />);
    expect(screen.getByTestId("zone-WHEEL_FL")).toBeTruthy();
    expect(screen.getByTestId("zone-CABIN")).toBeTruthy();
  });

  it("fills a shape with its worst status colour", () => {
    render(<VehicleDiagram results={results} />);
    expect(fillOf("zone-WHEEL_FL")).toBe(argb(statusColor("CRITICAL")));
    expect(fillOf("zone-ENGINE_BAY")).toBe(argb(statusColor("MONITOR")));
  });

  it("leaves unscored shapes neutral", () => {
    render(<VehicleDiagram results={results} />);
    expect(fillOf("zone-WHEEL_RR")).toBe(argb(statusColor("GOOD")));
  });

  it("spreads an axle status across both wheels on that axle", () => {
    render(<VehicleDiagram results={[{ diagramZone: "AXLE_FRONT", status: "ATTENTION" }] as any} />);
    expect(fillOf("zone-WHEEL_FL")).toBe(argb(statusColor("ATTENTION")));
    expect(fillOf("zone-WHEEL_FR")).toBe(argb(statusColor("ATTENTION")));
    expect(fillOf("zone-WHEEL_RL")).toBe(argb(statusColor("GOOD")));
  });

  it("reports the tapped shape", () => {
    const onShapePress = jest.fn();
    render(<VehicleDiagram results={results} onShapePress={onShapePress} />);
    fireEvent.press(screen.getByTestId("zone-WHEEL_FL"));
    expect(onShapePress).toHaveBeenCalledWith("WHEEL_FL");
  });

  it("renders with no results at all", () => {
    expect(() => render(<VehicleDiagram results={[]} />)).not.toThrow();
  });
});
