import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDiagramInspection } from "./useDiagramInspection";
import type { InspectionDetail } from "./healthScoreApi";

const detail = (id: string, vehicleId = "vehicle") => ({ id, vehicleId, results: [], submittedAt: null, odometerKm: null } satisfies InspectionDetail);

it("loads the exact inspection opened from the overview", async () => {
  const api = { getInspection: jest.fn().mockResolvedValue(detail("original")) };
  const { result } = renderHook(() => useDiagramInspection(api, "vehicle", "original"));
  await waitFor(() => expect(result.current.detail?.id).toBe("original"));
  expect(api.getInspection).toHaveBeenCalledWith("vehicle", "original");
});

it.each([detail("wrong"), detail("original", "other-vehicle")])("rejects a mismatched inspection response", async response => {
  const api = { getInspection: jest.fn().mockResolvedValue(response) };
  const { result } = renderHook(() => useDiagramInspection(api, "vehicle", "original"));
  await waitFor(() => expect(result.current.error).toMatch(/do not match/));
  expect(result.current.detail).toBeNull();
});

it("ignores a delayed response after the inspected vehicle changes", async () => {
  let resolve!: (value: InspectionDetail) => void;
  const pending = new Promise<InspectionDetail>(done => { resolve = done; });
  const api = { getInspection: jest.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(detail("second", "second-vehicle")) };
  const { result, rerender } = renderHook(({ vehicleId, inspectionId }: { vehicleId: string; inspectionId: string }) => useDiagramInspection(api, vehicleId, inspectionId),
    { initialProps: { vehicleId: "vehicle", inspectionId: "first" } });
  rerender({ vehicleId: "second-vehicle", inspectionId: "second" });
  await waitFor(() => expect(result.current.detail?.id).toBe("second"));
  await act(async () => { resolve(detail("first")); await pending; });
  expect(result.current.detail?.id).toBe("second");
});

it("recovers a failed request with an explicit retry", async () => {
  const api = { getInspection: jest.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(detail("original")) };
  const { result } = renderHook(() => useDiagramInspection(api, "vehicle", "original"));
  await waitFor(() => expect(result.current.error).toBe("Offline"));
  await act(async () => { await result.current.load(); });
  expect(result.current.error).toBeNull();
  expect(result.current.detail?.id).toBe("original");
});
