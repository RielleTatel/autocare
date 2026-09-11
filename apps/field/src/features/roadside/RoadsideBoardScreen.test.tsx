import { fireEvent, render, screen } from "@testing-library/react-native";
import type { RoadsideRequestView } from "@autocare/contracts";
import { RoadsideBoardScreen } from "./RoadsideBoardScreen";

const req = (over: Partial<RoadsideRequestView> = {}): RoadsideRequestView => ({
  id: "rr-1",
  vehicleId: "veh-1",
  incidentType: "FLAT_TYRE",
  lat: 6.9214,
  lng: 122.079,
  address: "Governor Camins Ave",
  landmarkNote: null,
  status: "REQUESTED",
  dispatchedToUserId: null,
  responderName: null,
  etaMinutes: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  resolvedAt: null,
  ...over,
});

const props = (over = {}) => ({
  requests: [req()],
  loading: false,
  error: null as string | null,
  onRefresh: jest.fn(),
  onDispatch: jest.fn(),
  onOpen: jest.fn(),
  onBack: jest.fn(),
  ...over,
});

describe("RoadsideBoardScreen (F-18)", () => {
  it("names the incident in words a person uses, not the enum", () => {
    render(<RoadsideBoardScreen {...props()} />);
    screen.getByText("Flat tyre");
  });

  it("shows where the member is so the advisor can judge the call", () => {
    render(<RoadsideBoardScreen {...props()} />);
    screen.getByText("Governor Camins Ave");
  });

  // Coordinates are all there is when geocoding failed — showing nothing would
  // strand the advisor with an incident they cannot place.
  it("falls back to coordinates when there is no address", () => {
    render(<RoadsideBoardScreen {...props({ requests: [req({ address: null })] })} />);
    screen.getByText("6.92140, 122.07900");
  });

  it("assigns a responder with a name and an ETA", () => {
    const p = props();
    render(<RoadsideBoardScreen {...p} />);
    fireEvent.press(screen.getByTestId("dispatch-rr-1"));
    fireEvent.changeText(screen.getByTestId("dispatch-responder"), "J. Cruz");
    fireEvent.changeText(screen.getByTestId("dispatch-eta"), "25");
    fireEvent.press(screen.getByTestId("dispatch-submit"));
    expect(p.onDispatch).toHaveBeenCalledWith("rr-1", { responderName: "J. Cruz", etaMinutes: 25 });
  });

  // The API requires a responder name; sending an empty one just earns a 400.
  it("will not dispatch without a responder name", () => {
    const p = props();
    render(<RoadsideBoardScreen {...p} />);
    fireEvent.press(screen.getByTestId("dispatch-rr-1"));
    fireEvent.press(screen.getByTestId("dispatch-submit"));
    expect(p.onDispatch).not.toHaveBeenCalled();
  });

  // ETA is optional — an advisor who does not know yet should still be able to
  // get a driver moving.
  it("dispatches without an ETA when none is given", () => {
    const p = props();
    render(<RoadsideBoardScreen {...p} />);
    fireEvent.press(screen.getByTestId("dispatch-rr-1"));
    fireEvent.changeText(screen.getByTestId("dispatch-responder"), "J. Cruz");
    fireEvent.press(screen.getByTestId("dispatch-submit"));
    expect(p.onDispatch).toHaveBeenCalledWith("rr-1", { responderName: "J. Cruz" });
  });

  it("offers no dispatch control on a call already assigned", () => {
    render(<RoadsideBoardScreen {...props({ requests: [req({ status: "EN_ROUTE", responderName: "J. Cruz", dispatchedToUserId: "drv-9" })] })} />);
    expect(screen.queryByTestId("dispatch-rr-1")).toBeNull();
    screen.getByText("J. Cruz");
  });

  it("opens an incident to work it", () => {
    const p = props();
    render(<RoadsideBoardScreen {...p} />);
    fireEvent.press(screen.getByTestId("incident-rr-1"));
    expect(p.onOpen).toHaveBeenCalledWith(req().id);
  });

  it("says the queue is empty rather than showing a blank screen", () => {
    render(<RoadsideBoardScreen {...props({ requests: [] })} />);
    screen.getByText(/no open roadside calls/i);
  });

  it("surfaces a load failure so the advisor knows to retry", () => {
    render(<RoadsideBoardScreen {...props({ requests: [], error: "Cannot reach the server." })} />);
    screen.getByText("Cannot reach the server.");
  });
});
