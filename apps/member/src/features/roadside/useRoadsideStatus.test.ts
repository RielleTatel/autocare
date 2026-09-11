import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useRoadsideStatus, ROADSIDE_POLL_MS } from "./useRoadsideStatus";
import { roadsideApi } from "./roadsideApi";

jest.mock("./roadsideApi", () => ({ roadsideApi: { byId: jest.fn() } }));

const base = {
  id: "rr-1",
  vehicleId: "veh-1",
  incidentType: "FLAT_TYRE" as const,
  lat: 6.9,
  lng: 122.0,
  address: null,
  landmarkNote: null,
  dispatchedToUserId: null,
  responderName: null,
  etaMinutes: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  resolvedAt: null,
};

describe("useRoadsideStatus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("polls at the spec's 15 second fallback interval", async () => {
    (roadsideApi.byId as jest.Mock).mockResolvedValue({ ...base, status: "DISPATCHED" });
    const { result } = renderHook(() => useRoadsideStatus({ ...base, status: "REQUESTED" }));

    await act(async () => {
      jest.advanceTimersByTime(ROADSIDE_POLL_MS);
    });
    await waitFor(() => expect(result.current.request.status).toBe("DISPATCHED"));
    expect(ROADSIDE_POLL_MS).toBe(15_000);
  });

  // Polling a finished incident forever drains a battery the member may need.
  it("stops polling once the request resolves", async () => {
    (roadsideApi.byId as jest.Mock).mockResolvedValue({
      ...base,
      status: "RESOLVED",
      resolvedAt: "2026-06-01T01:00:00.000Z",
    });
    renderHook(() => useRoadsideStatus({ ...base, status: "ON_SITE" }));

    await act(async () => {
      jest.advanceTimersByTime(ROADSIDE_POLL_MS);
    });
    const callsAfterResolve = (roadsideApi.byId as jest.Mock).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(ROADSIDE_POLL_MS * 3);
    });
    expect((roadsideApi.byId as jest.Mock).mock.calls.length).toBe(callsAfterResolve);
  });

  // A dropped signal is the normal case on a roadside. The last known status
  // must stay on screen rather than being replaced by an error.
  it("keeps the last known status when a poll fails", async () => {
    (roadsideApi.byId as jest.Mock).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useRoadsideStatus({ ...base, status: "EN_ROUTE" }));

    await act(async () => {
      jest.advanceTimersByTime(ROADSIDE_POLL_MS);
    });
    expect(result.current.request.status).toBe("EN_ROUTE");
    expect(result.current.error).toBe(true);
  });
});
