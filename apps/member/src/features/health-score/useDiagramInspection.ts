import { useCallback, useEffect, useRef, useState } from "react";
import type { HealthScoreApi, InspectionDetail } from "./healthScoreApi";

/** A diagram stays on the inspection opened from the score overview. */
export function useDiagramInspection(api: Pick<HealthScoreApi, "getInspection">, vehicleId: string, inspectionId: string) {
  const [state, setState] = useState<{ vehicleId: string; inspectionId: string; detail: InspectionDetail | null; error: string | null }>({ vehicleId, inspectionId, detail: null, error: null });
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setState({ vehicleId, inspectionId, detail: null, error: null });
    try {
      const detail = await api.getInspection(vehicleId, inspectionId);
      if (request !== generation.current) return;
      if (detail.id !== inspectionId || (detail.vehicleId !== undefined && detail.vehicleId !== vehicleId)) {
        throw new Error("Inspection findings do not match this vehicle. Please retry.");
      }
      setState({ vehicleId, inspectionId, detail, error: null });
    } catch (error) {
      if (request === generation.current) setState({ vehicleId, inspectionId, detail: null, error: error instanceof Error ? error.message : "Inspection findings could not be loaded. Please retry." });
    }
  }, [api, vehicleId, inspectionId]);
  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load]);
  const matches = state.vehicleId === vehicleId && state.inspectionId === inspectionId;
  return { detail: matches ? state.detail : null, error: matches ? state.error : null, load };
}
