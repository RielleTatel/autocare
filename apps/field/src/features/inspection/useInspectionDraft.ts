import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalResult } from "../../shared/db/inspections.repo";
import {
  CachedChecklist, CategoryProgress, Completeness, DraftDeps, InspectionDraft,
  categoryProgress, overallProgress,
} from "./draft";

export interface UseInspectionDraft {
  draft: InspectionDraft | null;
  results: LocalResult[];
  perCategory: CategoryProgress[];
  overall: { answered: number; total: number };
  check: Completeness | null;
  isLocked: boolean;
  saveResult(r: LocalResult): Promise<void>;
  submit(): Promise<void>;
  submitError: string | null;
}

/** React binding over InspectionDraft — state refresh after every save/submit. */
export function useInspectionDraft(
  deps: DraftDeps,
  input: { vehicleId: string; appointmentId?: string | null; odometerKm?: number | null; checklist: CachedChecklist },
): UseInspectionDraft {
  const [draft, setDraft] = useState<InspectionDraft | null>(null);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [check, setCheck] = useState<Completeness | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    InspectionDraft.start(deps, input).then(async (d) => {
      if (!mounted) return;
      setDraft(d);
      setResults(await d.results());
      setCheck(await d.completeness());
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one draft per mount
  }, []);

  const refresh = useCallback(async (d: InspectionDraft) => {
    setResults(await d.results());
    setCheck(await d.completeness());
  }, []);

  const saveResult = useCallback(async (r: LocalResult) => {
    if (!draft) return;
    await draft.saveResult(r);
    await refresh(draft);
  }, [draft, refresh]);

  const submit = useCallback(async () => {
    if (!draft) return;
    setSubmitError(null);
    try {
      await draft.submit();
      setIsLocked(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "submit failed");
    }
  }, [draft]);

  const { perCategory, overall } = useMemo(() => {
    if (!draft) return { perCategory: [] as CategoryProgress[], overall: { answered: 0, total: 0 } };
    return { perCategory: categoryProgress(draft.checklist, results), overall: overallProgress(draft.checklist, results) };
  }, [draft, results]);

  return { draft, results, perCategory, overall, check, isLocked, saveResult, submit, submitError };
}
