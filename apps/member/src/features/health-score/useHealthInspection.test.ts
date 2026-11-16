import { act, renderHook } from "@testing-library/react-native";
import { useHealthInspection } from "./useHealthInspection";
import type { HealthScore, InspectionDetail } from "./healthScoreApi";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const score = (inspectionId: string, vehicleId = "vehicle") => ({ vehicleId, inspectionId } as HealthScore);
const detail = (id: string, vehicleId = "vehicle") => ({ id, vehicleId, results: [{ pointCode: id, status: "CRITICAL" }] } as InspectionDetail);

it("ignores a delayed previous inspection after refresh selects a newer score", async () => {
  const oldDetail = deferred<InspectionDetail>();
  const api = { getScore: jest.fn().mockResolvedValueOnce(score("old")).mockResolvedValueOnce(score("new")),
    getInspection: jest.fn().mockReturnValueOnce(oldDetail.promise).mockResolvedValueOnce(detail("new")) };
  const { result } = renderHook(() => useHealthInspection(api, "vehicle"));
  let first!: Promise<void>;
  await act(async () => { first = result.current.load(); });
  await act(async () => { await result.current.load(); });
  await act(async () => { oldDetail.resolve(detail("old")); await first; });
  expect(result.current.score?.inspectionId).toBe("new");
  expect(result.current.results[0].pointCode).toBe("new");
});

it("keeps the score usable with an explicit error when the next findings request fails", async () => {
  const api = { getScore: jest.fn().mockResolvedValueOnce(score("old")).mockResolvedValueOnce(score("new")),
    getInspection: jest.fn().mockResolvedValueOnce(detail("old")).mockRejectedValueOnce(new Error("offline")) };
  const { result } = renderHook(() => useHealthInspection(api, "vehicle"));
  await act(async () => { await result.current.load(); });
  expect(result.current.results).toHaveLength(1);
  await act(async () => { await result.current.load(); });
  expect(result.current.score?.inspectionId).toBe("new");
  expect(result.current.results).toEqual([]);
  expect(result.current.resultsLoading).toBe(false);
  expect(result.current.resultsError).toMatch(/could not be loaded/);
  expect(result.current.error).toBeNull();
});

it.each([
  detail("other"),
  detail("expected", "other-vehicle"),
])("rejects findings that do not match the score and vehicle", async response => {
  const api = { getScore: jest.fn().mockResolvedValue(score("expected")), getInspection: jest.fn().mockResolvedValue(response) };
  const { result } = renderHook(() => useHealthInspection(api, "vehicle"));
  await act(async () => { await result.current.load(); });
  expect(result.current.results).toEqual([]);
  expect(result.current.resultsError).toMatch(/could not be loaded/);
});

it("hides the previous vehicle immediately and ignores its delayed findings", async () => {
  const firstDetail = deferred<InspectionDetail>();
  const secondScore = deferred<HealthScore>();
  const api = { getScore: jest.fn().mockResolvedValueOnce(score("first", "first-vehicle")).mockReturnValueOnce(secondScore.promise),
    getInspection: jest.fn().mockReturnValueOnce(firstDetail.promise).mockResolvedValueOnce(detail("second", "second-vehicle")) };
  const { result, rerender } = renderHook(({ vehicleId }: { vehicleId: string }) => useHealthInspection(api, vehicleId), { initialProps: { vehicleId: "first-vehicle" } });
  let first!: Promise<void>;
  await act(async () => { first = result.current.load(); });
  expect(result.current.score?.vehicleId).toBe("first-vehicle");
  rerender({ vehicleId: "second-vehicle" });
  expect(result.current.score).toBeNull();
  expect(result.current.results).toEqual([]);
  let second!: Promise<void>;
  await act(async () => { second = result.current.load(); });
  await act(async () => { firstDetail.resolve(detail("first", "first-vehicle")); await first; });
  expect(result.current.score).toBeNull();
  await act(async () => { secondScore.resolve(score("second", "second-vehicle")); await second; });
  expect(result.current.score?.vehicleId).toBe("second-vehicle");
  expect(result.current.results[0].pointCode).toBe("second");
});

it("does not request findings for a score that arrives after unmount", async () => {
  const pending = deferred<HealthScore>();
  const api = { getScore: jest.fn().mockReturnValue(pending.promise), getInspection: jest.fn() };
  const { result, unmount } = renderHook(() => useHealthInspection(api, "vehicle"));
  let load!: Promise<void>;
  act(() => { load = result.current.load(); });
  unmount();
  await act(async () => { pending.resolve(score("old")); await load; });
  expect(api.getInspection).not.toHaveBeenCalled();
});

it("shows an error and no findings when the score itself belongs to a different vehicle", async () => {
  const api = { getScore: jest.fn().mockResolvedValue(score("wrong", "other")), getInspection: jest.fn() };
  const { result } = renderHook(() => useHealthInspection(api, "vehicle"));
  await act(async () => { await result.current.load(); });
  expect(result.current.score).toBeNull();
  expect(result.current.error).toMatch(/does not match this vehicle/);
  expect(api.getInspection).not.toHaveBeenCalled();
});
