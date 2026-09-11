import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { VehicleHistory } from "./VehicleHistory";
import { getVehicleHistory } from "./historyApi";

jest.mock("./historyApi", () => ({ getVehicleHistory: jest.fn() }));
const mockGet = getVehicleHistory as jest.Mock;

const point = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "hs-1",
  inspectionId: "insp-1",
  score: 88,
  band: "GOOD",
  isStale: false,
  computedAt: "2026-09-01T00:00:00Z",
  odometerKm: 20_000,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("VehicleHistory", () => {
  it("leads with the most recent score and its band", async () => {
    mockGet.mockResolvedValue({ history: [point()], stale: false });

    render(<VehicleHistory vehicleId="veh-1" />);

    expect(await screen.findByText(/88/)).toBeTruthy();
    expect(screen.getByText("Most recent")).toBeTruthy();
  });

  it("lists earlier inspections under the latest one", async () => {
    mockGet.mockResolvedValue({
      history: [point(), point({ id: "hs-0", inspectionId: "insp-0", score: 61, band: "FAIR", computedAt: "2026-03-01T00:00:00Z" })],
      stale: false,
    });

    render(<VehicleHistory vehicleId="veh-1" />);

    // The latest reads 88; the earlier one is listed beneath it.
    expect(await screen.findByText("61")).toBeTruthy();
    expect(screen.getByText(/Fair/)).toBeTruthy();
  });

  it("renders nothing when the vehicle has never been inspected", async () => {
    // It sits directly above "Begin inspection"; an empty-state here would
    // compete with the primary action for no reason.
    mockGet.mockResolvedValue({ history: [], stale: false });

    const { toJSON } = render(<VehicleHistory vehicleId="veh-1" />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });

  it("says so when showing a cached copy", async () => {
    mockGet.mockResolvedValue({ history: [point()], stale: true });

    render(<VehicleHistory vehicleId="veh-1" />);

    expect(await screen.findByText(/last downloaded copy/i)).toBeTruthy();
  });

  it("opens a past inspection by its inspectionId, not the health-score id", async () => {
    // The distinction that made history unopenable before: only inspectionId
    // resolves against the detail route.
    mockGet.mockResolvedValue({ history: [point()], stale: false });
    const onOpen = jest.fn();

    render(<VehicleHistory vehicleId="veh-1" onOpenInspection={onOpen} />);
    fireEvent.press(await screen.findByLabelText(/Most recent inspection/));

    expect(onOpen).toHaveBeenCalledWith("insp-1");
  });

  it("stays inert when the fetch fails — reference data never blocks the task", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    const { toJSON } = render(<VehicleHistory vehicleId="veh-1" />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });
});
