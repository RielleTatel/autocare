import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HealthScore, HealthScoreApi, InspectionResultDetail } from "./healthScoreApi";

type Reader = Pick<HealthScoreApi, "getScore" | "getInspection">;
type Context = { api: Reader; vehicleId: string };
type State = {
  context: Context;
  score: HealthScore | null;
  results: InspectionResultDetail[];
  error: string | null;
  resultsLoading: boolean;
  resultsError: string | null;
};

/** Keeps score and findings on the same vehicle/inspection across overlapping refreshes. */
export function useHealthInspection(api: Reader, vehicleId: string) {
  const context = useMemo(() => ({ api, vehicleId }), [api, vehicleId]);
  const currentContext = useRef(context);
  currentContext.current = context;
  const empty = { context, score: null, results: [], error: null, resultsLoading: false, resultsError: null } satisfies State;
  const [state, setState] = useState<State>(empty);
  const requestGeneration = useRef(0);
  const load = useCallback(async () => {
    if (currentContext.current !== context) return;
    const generation = ++requestGeneration.current;
    const current = () => generation === requestGeneration.current && currentContext.current === context;
    setState({ context, score: null, results: [], error: null, resultsLoading: false, resultsError: null });
    try {
      const next = await api.getScore(vehicleId);
      if (!current()) return;
      if (next.vehicleId !== vehicleId) throw new Error("The health score does not match this vehicle. Please retry.");
      setState({ context, score: next, results: [], error: null, resultsLoading: true, resultsError: null });
      try {
        const detail = await api.getInspection(vehicleId, next.inspectionId);
        if (!current()) return;
        if (detail.id !== next.inspectionId || (detail.vehicleId !== undefined && detail.vehicleId !== vehicleId)) {
          throw new Error("Inspection findings do not match this vehicle's score.");
        }
        setState({ context, score: next, results: detail.results, error: null, resultsLoading: false, resultsError: null });
      } catch {
        if (current()) setState({ context, score: next, results: [], error: null, resultsLoading: false, resultsError: "Inspection findings could not be loaded. Please retry." });
      }
    } catch (error) {
      if (current()) setState({ context, score: null, results: [], error: error instanceof Error ? error.message : "No score yet", resultsLoading: false, resultsError: null });
    }
  }, [api, context, vehicleId]);
  useEffect(() => () => { requestGeneration.current++; }, [context]);
  // A new vehicle must not paint the previous vehicle's data before its load effect runs.
  return { ...(state.context === context ? state : empty), load };
}
