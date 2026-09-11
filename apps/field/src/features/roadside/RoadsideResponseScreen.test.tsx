import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import type { RoadsideRequestView } from "@autocare/contracts";
import { RoadsideResponseScreen } from "./RoadsideResponseScreen";

// Spy on the real module rather than mocking a deep internal path: RN moves
// those between versions, and a stale path mocks nothing while still passing.
const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

const req = (over: Partial<RoadsideRequestView> = {}): RoadsideRequestView => ({
  id: "rr-1",
  vehicleId: "veh-1",
  incidentType: "DEAD_BATTERY",
  lat: 6.9036,
  lng: 122.0644,
  address: "Governor Lim Avenue",
  landmarkNote: "Beside the blue gate",
  status: "DISPATCHED",
  dispatchedToUserId: "drv-9",
  responderName: "J. Cruz",
  etaMinutes: 25,
  createdAt: "2026-06-01T00:00:00.000Z",
  resolvedAt: null,
  ...over,
});

const props = (over = {}) => ({
  request: req(),
  busy: false,
  error: null as string | null,
  onSetStatus: jest.fn(),
  onResolve: jest.fn(),
  onBack: jest.fn(),
  ...over,
});

describe("RoadsideResponseScreen (F-17)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("leads with what happened and where", () => {
    render(<RoadsideResponseScreen {...props()} />);
    screen.getByText("Dead battery");
    screen.getByText("Governor Lim Avenue");
    screen.getByText("Beside the blue gate");
  });

  // The driver's own maps app does turn-by-turn; we only hand off coordinates.
  it("hands the coordinates to the phone's maps app", () => {
    render(<RoadsideResponseScreen {...props()} />);
    fireEvent.press(screen.getByTestId("roadside-navigate"));
    expect(openURL).toHaveBeenCalledWith("https://maps.google.com/?q=6.9036,122.0644");
  });

  it("offers the next step forward from DISPATCHED", () => {
    const p = props();
    render(<RoadsideResponseScreen {...p} />);
    fireEvent.press(screen.getByTestId("advance-EN_ROUTE"));
    expect(p.onSetStatus).toHaveBeenCalledWith("EN_ROUTE");
  });

  // The server rejects backwards moves with a 409; the UI should never offer
  // one in the first place.
  it("never offers a step already passed", () => {
    render(<RoadsideResponseScreen {...props({ request: req({ status: "ON_SITE" }) })} />);
    expect(screen.queryByTestId("advance-EN_ROUTE")).toBeNull();
    expect(screen.queryByTestId("advance-DISPATCHED")).toBeNull();
  });

  it("only offers resolving once the responder is on site", () => {
    render(<RoadsideResponseScreen {...props()} />);
    expect(screen.queryByTestId("resolve-open")).toBeNull();
    render(<RoadsideResponseScreen {...props({ request: req({ status: "ON_SITE" }) })} />);
    expect(screen.getByTestId("resolve-open")).toBeTruthy();
  });

  it("records the outcome and the cost in centavos", () => {
    const p = props({ request: req({ status: "ON_SITE" }) });
    render(<RoadsideResponseScreen {...p} />);
    fireEvent.press(screen.getByTestId("resolve-open"));
    fireEvent.changeText(screen.getByTestId("resolve-notes"), "Jump-started on site");
    fireEvent.changeText(screen.getByTestId("resolve-cost"), "450");
    fireEvent.press(screen.getByTestId("resolve-submit"));
    expect(p.onResolve).toHaveBeenCalledWith({ resolutionNotes: "Jump-started on site", costCentavos: 45000 });
  });

  // The contract demands at least 3 characters of notes; an empty submit just
  // earns a 400 the driver cannot interpret.
  it("will not resolve without notes", () => {
    const p = props({ request: req({ status: "ON_SITE" }) });
    render(<RoadsideResponseScreen {...p} />);
    fireEvent.press(screen.getByTestId("resolve-open"));
    fireEvent.press(screen.getByTestId("resolve-submit"));
    expect(p.onResolve).not.toHaveBeenCalled();
  });

  it("treats a blank cost as zero rather than blocking the close-out", () => {
    const p = props({ request: req({ status: "ON_SITE" }) });
    render(<RoadsideResponseScreen {...p} />);
    fireEvent.press(screen.getByTestId("resolve-open"));
    fireEvent.changeText(screen.getByTestId("resolve-notes"), "Tyre changed");
    fireEvent.press(screen.getByTestId("resolve-submit"));
    expect(p.onResolve).toHaveBeenCalledWith({ resolutionNotes: "Tyre changed", costCentavos: 0 });
  });

  it("closes the loop when the call is done", () => {
    render(<RoadsideResponseScreen {...props({ request: req({ status: "RESOLVED", resolvedAt: "2026-06-01T01:00:00.000Z" }) })} />);
    // The pill also reads "Resolved", so match the body copy specifically.
    screen.getByText(/this call is resolved/i);
    expect(screen.queryByTestId("resolve-open")).toBeNull();
  });

  it("surfaces a failed update instead of silently doing nothing", () => {
    render(<RoadsideResponseScreen {...props({ error: "Cannot reach the server." })} />);
    screen.getByText("Cannot reach the server.");
  });
});
