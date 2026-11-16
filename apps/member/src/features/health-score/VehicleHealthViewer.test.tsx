import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { VehicleHealthViewer } from "./VehicleHealthViewer";
import type { InspectionResultDetail } from "./healthScoreApi";

let mockHang = false;
let mockRendererProps: { onReady: () => void; onLoading: () => void };

jest.mock("./VehicleDiagram3D", () => ({ VehicleDiagram3D: (props: any) => {
  const { onError } = props;
  mockRendererProps = props;
  const { useEffect } = require("react");
  useEffect(() => { if (!mockHang) onError(new Error("Model unavailable")); }, []);
  return null;
}}));

it("recovers a renderer failure into 2D and preserves accessible region selections", async () => {
  const onShapePress = jest.fn();
  render(<VehicleHealthViewer results={[{ diagramZone: "AXLE_FRONT", status: "CRITICAL" }] as InspectionResultDetail[]} onShapePress={onShapePress} />);
  expect(await screen.findByText(/3D is unavailable/)).toBeTruthy();
  expect(screen.getByTestId("zone-WHEEL_FL")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Front-right wheel: Critical"));
  expect(onShapePress).toHaveBeenCalledWith("WHEEL_FR");
});

it("labels missing observations separately from explicit N/A", () => {
  render(<VehicleHealthViewer results={[{ diagramZone: "CABIN", status: "NOT_APPLICABLE" }] as InspectionResultDetail[]} onShapePress={jest.fn()} />);
  expect(screen.getByLabelText("Cabin: Not applicable")).toBeTruthy();
  expect(screen.getByLabelText("Engine bay: No findings recorded")).toBeTruthy();
});


it("falls back if native model initialization never completes", async () => {
  jest.useFakeTimers();
  mockHang = true;
  try {
    render(<VehicleHealthViewer results={[]} onShapePress={jest.fn()} />);
    await act(async () => {});
    act(() => { jest.advanceTimersByTime(15000); });
    expect(screen.getByText(/3D is unavailable/)).toBeTruthy();
    expect(screen.getByTestId("zone-ENGINE_BAY")).toBeTruthy();
  } finally {
    mockHang = false;
    jest.useRealTimers();
  }
});

it("keeps unknown future zones discoverable through category breakdown", () => {
  render(<VehicleHealthViewer results={[{ diagramZone: "NEW_REGION", status: "GOOD" }] as unknown as InspectionResultDetail[]} onShapePress={jest.fn()} />);
  expect(screen.getByText(/Some findings have no known location/)).toBeTruthy();
});


it("lets a member retry 3D after a recoverable initialization failure", async () => {
  render(<VehicleHealthViewer results={[]} onShapePress={jest.fn()} />);
  expect(await screen.findByText(/3D is unavailable/)).toBeTruthy();
  mockHang = true;
  try {
    fireEvent.press(screen.getByLabelText("3D vehicle view"));
    await act(async () => {});
    expect(screen.queryByText(/3D is unavailable/)).toBeNull();
    expect(screen.getByLabelText("Loading vehicle model")).toBeTruthy();
    act(() => mockRendererProps.onReady());
    expect(screen.queryByLabelText("Loading vehicle model")).toBeNull();
  } finally { mockHang = false; }
});

it("pauses initialization timeout in background and reapplies it to a resumed context", async () => {
  jest.useFakeTimers();
  mockHang = true;
  let change!: (state: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, "addEventListener").mockImplementation((_, callback) => {
    change = callback;
    return { remove: jest.fn() };
  });
  try {
    render(<VehicleHealthViewer results={[]} onShapePress={jest.fn()} />);
    await act(async () => {});
    act(() => mockRendererProps.onReady());
    act(() => { change("background"); mockRendererProps.onLoading(); jest.advanceTimersByTime(16000); });
    expect(screen.queryByText(/3D is unavailable/)).toBeNull();
    act(() => change("active"));
    act(() => { jest.advanceTimersByTime(15000); });
    expect(screen.getByText(/3D is unavailable/)).toBeTruthy();
  } finally { listener.mockRestore(); mockHang = false; jest.useRealTimers(); }
});
