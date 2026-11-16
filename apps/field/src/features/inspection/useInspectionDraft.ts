import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
  /** Resolves true on success, false on failure (details land in submitError) — lets
   * callers decide whether to navigate away without racing the next render's state. */
  submit(): Promise<boolean>;
  submitError: string | null;
  flush(): Promise<void>;
}

/** React binding over InspectionDraft — state refresh after every save/submit. */
export function useInspectionDraft(
  deps: DraftDeps,
  input: { vehicleId: string; appointmentId: string; odometerKm?: number | null; checklist: CachedChecklist },
): UseInspectionDraft {
  const [draft, setDraft] = useState<InspectionDraft | null>(null);
  const [results, setResults] = useState<LocalResult[]>([]);
  const [check, setCheck] = useState<Completeness | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pendingSaves = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    InspectionDraft.start(deps, input)
      .then(async (d) => {
        if (!mounted) return;
        setDraft(d);
        setIsLocked(d.isLocked);
        setResults(await d.results());
        setCheck(await d.completeness());
      })
      .catch((e) => { if (mounted) setSubmitError(e instanceof Error ? e.message : "Could not start inspection"); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one draft per mount
  }, []);

  const refresh = useCallback(async (d: InspectionDraft) => {
    setResults(await d.results());
    setCheck(await d.completeness());
  }, []);

  const saveResult = useCallback(async (r: LocalResult) => {
    if (!draft) return;
    const write = pendingSaves.current.then(() => draft.saveResult(r));
    pendingSaves.current = write.catch(() => undefined);
    await write;
    await refresh(draft);
  }, [draft, refresh]);

  const flush = useCallback(async () => { await pendingSaves.current; }, []);

  const submit = useCallback(async () => {
    if (!draft) return false;
    setSubmitError(null);
    try {
      await pendingSaves.current;
      await draft.submit();
      setIsLocked(true);
      return true;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "submit failed");
      return false;
    }
  }, [draft]);

  const { perCategory, overall } = useMemo(() => {
    if (!draft) return { perCategory: [] as CategoryProgress[], overall: { answered: 0, total: 0 } };
    return { perCategory: categoryProgress(draft.checklist, results), overall: overallProgress(draft.checklist, results) };
  }, [draft, results]);

  return { draft, results, perCategory, overall, check, isLocked, saveResult, submit, submitError, flush };
}
