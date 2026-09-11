import { ApiError } from "@autocare/api-client";
import { getActiveChecklist } from "./checklistCache";
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

const CHECKLIST = { id: "cl-1", categories: [] };

beforeEach(() => jest.clearAllMocks());

describe("getActiveChecklist", () => {
  it("refreshes from the server and overwrites the cache", async () => {
    mockApi.get.mockResolvedValue(CHECKLIST);

    await expect(getActiveChecklist()).resolves.toEqual(CHECKLIST);
    // Namespaced by backend: the same logical checklist has different ids per DB.
    expect(mockKvSet).toHaveBeenCalledWith("checklist:active:http://test-api", JSON.stringify(CHECKLIST));
  });

  it("serves the cache when the server is unreachable", async () => {
    mockApi.get.mockRejectedValue(new ApiError("NETWORK", "Cannot reach the server.", 0));
    mockKvGet.mockResolvedValue(JSON.stringify(CHECKLIST));

    await expect(getActiveChecklist()).resolves.toEqual(CHECKLIST);
  });

  it("serves the cache when the server is broken (5xx)", async () => {
    mockApi.get.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    mockKvGet.mockResolvedValue(JSON.stringify(CHECKLIST));

    await expect(getActiveChecklist()).resolves.toEqual(CHECKLIST);
  });

  it("rethrows when the server is reachable and rejects, even with a usable cache", async () => {
    // The regression this guards: a 404 (no active checklist) used to be
    // swallowed, so a stale checklist from another database was served and the
    // technician completed a whole inspection that could only ever be rejected
    // at sync time with CHECKLIST_INVALID.
    mockApi.get.mockRejectedValue(new ApiError("CHECKLIST_INVALID", "no active checklist", 404));
    mockKvGet.mockResolvedValue(JSON.stringify(CHECKLIST));

    await expect(getActiveChecklist()).rejects.toMatchObject({ status: 404 });
  });

  it("rethrows on an auth failure rather than serving a stale checklist", async () => {
    mockApi.get.mockRejectedValue(new ApiError("AUTH_TOKEN_INVALID", "Token invalid or expired", 401));
    mockKvGet.mockResolvedValue(JSON.stringify(CHECKLIST));

    await expect(getActiveChecklist()).rejects.toMatchObject({ status: 401 });
  });

  it("explains itself when offline with nothing cached", async () => {
    mockApi.get.mockRejectedValue(new ApiError("NETWORK", "Cannot reach the server.", 0));
    mockKvGet.mockResolvedValue(null);

    await expect(getActiveChecklist()).rejects.toThrow(/connect to the internet once/i);
  });
});
