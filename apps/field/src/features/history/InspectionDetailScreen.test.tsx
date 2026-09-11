import { render, screen } from "@testing-library/react-native";
import { InspectionDetailScreen } from "./InspectionDetailScreen";
import { getInspectionDetail } from "./historyApi";

jest.mock("./historyApi", () => ({ getInspectionDetail: jest.fn() }));
const mockGet = getInspectionDetail as jest.Mock;

const result = (over: Partial<Record<string, unknown>> = {}) => ({
  pointCode: "PAD",
  label: "Front brake pads",
  categoryCode: "BRAKES",
  status: "GOOD",
  measuredValue: null,
  unit: null,
  recommendation: "",
  isSafetyCritical: false,
  notes: null,
  photoUrls: [],
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("InspectionDetailScreen", () => {
  it("shows when the inspection was done and at what odometer", async () => {
    mockGet.mockResolvedValue({ id: "insp-1", submittedAt: "2026-09-01T00:00:00Z", odometerKm: 31_000, results: [result()] });

    render(<InspectionDetailScreen vehicleId="veh-1" inspectionId="insp-1" />);

    expect(await screen.findByText(/31,000 km/)).toBeTruthy();
  });

  it("surfaces adverse findings in their own section", async () => {
    // A technician opening history is looking for what was wrong, so the
    // adverse points are pulled out of checklist order.
    mockGet.mockResolvedValue({
      id: "insp-1",
      submittedAt: "2026-09-01T00:00:00Z",
      odometerKm: 1,
      results: [result(), result({ pointCode: "DISC", label: "Brake discs", status: "CRITICAL" })],
    });

    render(<InspectionDetailScreen vehicleId="veh-1" inspectionId="insp-1" />);

    expect(await screen.findByText("Findings")).toBeTruthy();
    expect(screen.getByText("Brake discs")).toBeTruthy();
  });

  it("omits the findings section when nothing was adverse", async () => {
    mockGet.mockResolvedValue({ id: "insp-1", submittedAt: null, odometerKm: null, results: [result()] });

    render(<InspectionDetailScreen vehicleId="veh-1" inspectionId="insp-1" />);

    expect(await screen.findByText("All points")).toBeTruthy();
    expect(screen.queryByText("Findings")).toBeNull();
  });

  it("shows a measured value with its unit", async () => {
    mockGet.mockResolvedValue({
      id: "insp-1", submittedAt: null, odometerKm: null,
      results: [result({ measuredValue: 8, unit: "mm" })],
    });

    render(<InspectionDetailScreen vehicleId="veh-1" inspectionId="insp-1" />);

    expect(await screen.findByText("8 mm")).toBeTruthy();
  });

  it("explains that detail needs a connection rather than failing silently", async () => {
    // Unlike the history list, per-point detail is not cached.
    mockGet.mockRejectedValue(new Error("offline"));

    render(<InspectionDetailScreen vehicleId="veh-1" inspectionId="insp-1" />);

    expect(await screen.findByText(/needs a connection/i)).toBeTruthy();
  });
});
