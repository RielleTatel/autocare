import { getVehicleHistory, getInspectionDetail } from "./historyApi";
import { api } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";

jest.mock("../../shared/api", () => ({
  API_BASE_URL: "http://test-api",
  api: { get: jest.fn() },
}));
jest.mock("../../shared/db/kv", () => ({ kvGet: jest.fn(), kvSet: jest.fn() }));

const mockApi = api as unknown as { get: jest.Mock };
const mockKvGet = kvGet as jest.Mock;
const mockKvSet = kvSet as jest.Mock;

// The endpoint returns oldest-first.
const SERVER_ORDER = [
  { id: "hs-old", inspectionId: "insp-old", score: 61, band: "FAIR", isStale: false, computedAt: "2026-03-01T00:00:00Z", odometerKm: 10_000 },
  { id: "hs-new", inspectionId: "insp-new", score: 88, band: "GOOD", isStale: false, computedAt: "2026-09-01T00:00:00Z", odometerKm: 20_000 },
];

beforeEach(() => jest.clearAllMocks());

describe("getVehicleHistory", () => {
  it("returns most recent first, which is the order a technician reads", async () => {
    mockApi.get.mockResolvedValue(SERVER_ORDER);

    const { history, stale } = await getVehicleHistory("veh-1");

    expect(history.map((h) => h.inspectionId)).toEqual(["insp-new", "insp-old"]);
    expect(stale).toBe(false);
  });

  it("caches under a backend-namespaced key", async () => {
    mockApi.get.mockResolvedValue(SERVER_ORDER);

    await getVehicleHistory("veh-1");

    // Namespaced: ids differ per database, so a cache shared across backends
    // would hand the detail route an id this server has never seen.
    expect(mockKvSet.mock.calls[0][0]).toBe("vhs:http://test-api:veh-1");
  });

  it("serves the cache and flags it stale when the request fails", async () => {
    mockApi.get.mockRejectedValue(new Error("offline"));
    mockKvGet.mockResolvedValue(JSON.stringify(SERVER_ORDER));

    const { history, stale } = await getVehicleHistory("veh-1");

    expect(history).toHaveLength(2);
    expect(stale).toBe(true);
  });

  it("treats no history as an empty list, never an error", async () => {
    // A vehicle that has never been inspected is a normal state, and this is
    // reference data beside a primary action — it must not throw into the flow.
    mockApi.get.mockRejectedValue(new Error("404"));
    mockKvGet.mockResolvedValue(null);

    await expect(getVehicleHistory("veh-1")).resolves.toEqual({ history: [], stale: false });
  });
});

describe("getInspectionDetail", () => {
  it("requests the detail route for the given inspection", async () => {
    mockApi.get.mockResolvedValue({ id: "insp-new", submittedAt: null, odometerKm: 1, results: [] });

    await getInspectionDetail("veh-1", "insp-new");

    expect(mockApi.get).toHaveBeenCalledWith("/vehicles/veh-1/inspections/insp-new");
  });
});
