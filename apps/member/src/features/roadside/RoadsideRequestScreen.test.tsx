import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import { RoadsideRequestScreen } from "./RoadsideRequestScreen";

jest.mock("./IncidentMap", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    IncidentMap: (props: Record<string, unknown>) => React.createElement(View, { testID: "incident-map", ...props }),
  };
});
jest.mock("./location", () => ({ resolveAddress: jest.fn().mockResolvedValue("Dragged street, Zamboanga City") }));

const eligible = { eligible: true };
const located = { ok: true as const, lat: 6.9214, lng: 122.079, address: "Governor Camins Ave, Zamboanga City" };
const props = () => ({
  eligibility: eligible,
  location: located,
  onRetryLocation: jest.fn(),
  onSubmit: jest.fn(),
  onCallHotline: jest.fn(),
  submitting: false,
  error: null as string | null,
});

describe("RoadsideRequestScreen (M-26)", () => {
  it("offers every incident type the spec lists", () => {
    const { getByText } = render(<RoadsideRequestScreen {...props()} />);
    for (const label of [
      "Flat tyre",
      "Dead battery",
      "Out of fuel",
      "Overheating",
      "Won't start",
      "Accident",
      "Other",
    ]) {
      getByText(label);
    }
  });

  it("cannot send until an incident type is chosen", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} />);
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).not.toHaveBeenCalled();
  });

  it("sends the incident, coordinates and landmark together", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} />);
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.changeText(getByTestId("roadside-landmark"), "Beside the blue gate");
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).toHaveBeenCalledWith({
      incidentType: "FLAT_TYRE",
      lat: 6.9214,
      lng: 122.079,
      address: "Governor Camins Ave, Zamboanga City",
      landmarkNote: "Beside the blue gate",
    });
  });

  // D-3 — the stored coordinates are the member's confirmation, not the raw fix.
  it("sends the dragged pin position rather than the original GPS fix", async () => {
    const p = props();
    const { getByTestId, getByText } = render(<RoadsideRequestScreen {...p} />);
    await act(async () => {
      (getByTestId("incident-map").props as { onMove: (lat: number, lng: number) => void }).onMove(7.1, 122.5);
    });
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    await waitFor(() => expect(getByTestId("incident-map").props.lat).toBe(7.1));
    // The re-geocode is debounced, so the honest address arrives a beat later.
    await waitFor(() => getByText("Dragged street, Zamboanga City"), { timeout: 3000 });
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 7.1, lng: 122.5, address: "Dragged street, Zamboanga City" }),
    );
  });

  // FR-035 — a refusal has to name the date and never read as a punishment.
  it("explains a waiting period instead of just disabling the button", () => {
    const { getByText, queryByTestId } = render(
      <RoadsideRequestScreen
        {...props()}
        eligibility={{
          eligible: false,
          reason: "Roadside assistance opens 30 days after your first payment. You're covered from 2026-07-01.",
        }}
      />,
    );
    getByText(/opens 30 days after your first payment/);
    expect(queryByTestId("roadside-submit")).toBeNull();
  });

  // FR-040 — the fallback must be reachable even when the app path is blocked.
  it("offers the hotline whether or not the member is eligible", () => {
    const p = props();
    const { getByTestId } = render(
      <RoadsideRequestScreen {...p} eligibility={{ eligible: false, reason: "Not yet." }} />,
    );
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(p.onCallHotline).toHaveBeenCalled();
  });

  // FR-032 — denying location must not dead-end the request.
  it("asks for a landmark and still allows sending when location is denied", () => {
    const p = props();
    const { getByText, getByTestId, queryByTestId } = render(
      <RoadsideRequestScreen {...p} location={{ ok: false, reason: "DENIED" }} />,
    );
    getByText(/tell us where you are/i);
    expect(queryByTestId("incident-map")).toBeNull();
    fireEvent.press(getByTestId("incident-ACCIDENT"));
    fireEvent.changeText(getByTestId("roadside-landmark"), "KM 12 near the covered court");
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ incidentType: "ACCIDENT", landmarkNote: "KM 12 near the covered court" }),
    );
  });

  it("will not send without location or a landmark", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} location={{ ok: false, reason: "DENIED" }} />);
    fireEvent.press(getByTestId("incident-OTHER"));
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
});
