import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { RoadsideRequestView } from "@autocare/contracts";
import { RoadsideContainer } from "./RoadsideContainer";
import { roadsideApi } from "./roadsideApi";

jest.mock("./roadsideApi", () => ({
  roadsideApi: { board: jest.fn(), dispatch: jest.fn(), setStatus: jest.fn(), resolve: jest.fn() },
}));

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

describe("RoadsideContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (roadsideApi.board as jest.Mock).mockResolvedValue([req()]);
  });

  it("shows the queue once it loads", async () => {
    render(<RoadsideContainer userId="drv-9" role="ADVISOR" />);
    expect(await screen.findByTestId("roadside-board-screen")).toBeTruthy();
  });

  // A driver who already has a call should land on it, not have to pick their
  // own incident out of a shared queue on the roadside.
  it("takes a driver straight to the call assigned to them", async () => {
    (roadsideApi.board as jest.Mock).mockResolvedValue([
      req({ id: "rr-other", dispatchedToUserId: "drv-1", responderName: "Someone Else", status: "EN_ROUTE" }),
      req({ id: "rr-mine", dispatchedToUserId: "drv-9", responderName: "J. Cruz", status: "DISPATCHED" }),
    ]);
    render(<RoadsideContainer userId="drv-9" role="DRIVER" />);
    expect(await screen.findByTestId("roadside-response-screen")).toBeTruthy();
  });

  it("leaves a driver with no assignment on the queue", async () => {
    (roadsideApi.board as jest.Mock).mockResolvedValue([req({ dispatchedToUserId: "drv-1" })]);
    render(<RoadsideContainer userId="drv-9" role="DRIVER" />);
    expect(await screen.findByTestId("roadside-board-screen")).toBeTruthy();
  });

  it("dispatches a responder and reflects the result", async () => {
    (roadsideApi.dispatch as jest.Mock).mockResolvedValue(
      req({ status: "DISPATCHED", dispatchedToUserId: null, responderName: "J. Cruz", etaMinutes: 25 }),
    );
    render(<RoadsideContainer userId="adv-1" role="ADVISOR" />);
    fireEvent.press(await screen.findByTestId("dispatch-rr-1"));
    fireEvent.changeText(screen.getByTestId("dispatch-responder"), "J. Cruz");
    fireEvent.press(screen.getByTestId("dispatch-submit"));
    await waitFor(() => expect(roadsideApi.dispatch).toHaveBeenCalledWith("rr-1", { responderName: "J. Cruz" }));
    await screen.findByText("J. Cruz · about 25 min");
  });

  it("walks an opened call forward", async () => {
    (roadsideApi.board as jest.Mock).mockResolvedValue([req({ status: "DISPATCHED", responderName: "J. Cruz" })]);
    (roadsideApi.setStatus as jest.Mock).mockResolvedValue(req({ status: "EN_ROUTE", responderName: "J. Cruz" }));
    render(<RoadsideContainer userId="adv-1" role="ADVISOR" />);
    fireEvent.press(await screen.findByTestId("incident-rr-1"));
    fireEvent.press(await screen.findByTestId("advance-EN_ROUTE"));
    await waitFor(() => expect(roadsideApi.setStatus).toHaveBeenCalledWith("rr-1", { status: "EN_ROUTE" }));
  });

  // A 409 from a stale board is the expected collision here: someone else moved
  // the call first. The driver has to see that, not a dead button.
  it("surfaces a rejected transition", async () => {
    (roadsideApi.board as jest.Mock).mockResolvedValue([req({ status: "DISPATCHED", responderName: "J. Cruz" })]);
    (roadsideApi.setStatus as jest.Mock).mockRejectedValue(
      Object.assign(new Error("A request cannot move from ON_SITE back to EN_ROUTE."), { code: "DUPLICATE_REQUEST" }),
    );
    render(<RoadsideContainer userId="adv-1" role="ADVISOR" />);
    fireEvent.press(await screen.findByTestId("incident-rr-1"));
    fireEvent.press(await screen.findByTestId("advance-EN_ROUTE"));
    await screen.findByText(/cannot move from ON_SITE/);
  });

  it("reports a queue it could not load", async () => {
    (roadsideApi.board as jest.Mock).mockRejectedValue(new Error("Cannot reach the server."));
    render(<RoadsideContainer userId="adv-1" role="ADVISOR" />);
    await screen.findByText("Cannot reach the server.");
  });
});
