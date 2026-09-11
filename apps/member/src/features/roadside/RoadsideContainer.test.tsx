import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { RoadsideContainer } from "./RoadsideContainer";
import { roadsideApi } from "./roadsideApi";
import { captureLocation } from "./location";

jest.mock("./roadsideApi", () => ({
  roadsideApi: { eligibility: jest.fn(), create: jest.fn(), active: jest.fn(), byId: jest.fn() },
}));
jest.mock("./location", () => ({ captureLocation: jest.fn(), resolveAddress: jest.fn().mockResolvedValue(null) }));
jest.mock("./IncidentMap", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    IncidentMap: (props: Record<string, unknown>) => React.createElement(View, { testID: "incident-map", ...props }),
  };
});
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
const Linking = require("expo-linking");

const vehicleId = "3f1a0c9e-0000-4000-8000-000000000001";

describe("RoadsideContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (captureLocation as jest.Mock).mockResolvedValue({ ok: true, lat: 6.9, lng: 122.0, address: "Somewhere" });
    (roadsideApi.active as jest.Mock).mockResolvedValue(null);
    (roadsideApi.eligibility as jest.Mock).mockResolvedValue({ eligible: true });
  });

  it("shows the request screen when nothing is open", async () => {
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
  });

  // Coming back to the app mid-incident must land on the status, not on a
  // form that would open a second request.
  it("goes straight to the status screen when an incident is already live", async () => {
    (roadsideApi.active as jest.Mock).mockResolvedValue({
      id: "rr-1",
      vehicleId,
      incidentType: "FLAT_TYRE",
      lat: 6.9,
      lng: 122.0,
      address: null,
      landmarkNote: null,
      status: "EN_ROUTE",
      responderName: "J. Cruz",
      etaMinutes: 15,
      createdAt: "2026-06-01T00:00:00.000Z",
      resolvedAt: null,
    });
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-status-screen"));
  });

  it("moves to the status screen after a successful request", async () => {
    (roadsideApi.create as jest.Mock).mockResolvedValue({
      id: "rr-2",
      vehicleId,
      incidentType: "FLAT_TYRE",
      lat: 6.9,
      lng: 122.0,
      address: null,
      landmarkNote: null,
      status: "REQUESTED",
      responderName: null,
      etaMinutes: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      resolvedAt: null,
    });
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.press(getByTestId("roadside-submit"));
    await waitFor(() => getByTestId("roadside-status-screen"));
  });

  it("surfaces a refusal instead of silently failing", async () => {
    (roadsideApi.create as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Not covered yet"), { code: "ROADSIDE_NOT_ELIGIBLE" }),
    );
    const { getByTestId, getByText } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.press(getByTestId("roadside-submit"));
    await waitFor(() => getByText("Not covered yet"));
  });

  it("dials the hotline through the OS (FR-040)", async () => {
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^tel:/));
  });
});
