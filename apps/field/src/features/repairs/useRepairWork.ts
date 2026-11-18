import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@autocare/api-client";
import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import { acquireRepairReturnHold, getInspectionRepair, getRepair, sendRepairAction, type RepairReturnSlot, type RepairWorkOrder } from "./repairApi";
import { emptyRepairDraft, estimateText, parseRepairEstimate, RepairDraftStore, type PendingRepairAction, type RepairContext, type RepairDraft } from "./repairDraft";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Could not reach the repair service. Reconnect and refresh.";
}

export function useRepairWork(context: RepairContext) {
  const store = useMemo(() => new RepairDraftStore(context), [context.vehicleId, context.inspectionId]);
  const [draft, setDraft] = useState<RepairDraft>(() => emptyRepairDraft(context));
  const current = useRef(draft);
  const [repair, setRepair] = useState<RepairWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const active = useRef(true);
  const executing = useRef(false);
  const saveNumber = useRef(0);

  const persist = useCallback(async (value: RepairDraft) => {
    current.current = value;
    setDraft(value);
    const attempt = ++saveNumber.current;
    setSaving(true);
    try {
      await store.save(value);
      if (active.current && attempt === saveNumber.current) setLocalError(null);
    } catch (error) {
      if (active.current) setLocalError(`Could not save this draft on the device. ${message(error)}`);
      throw error;
    } finally {
      if (active.current && attempt === saveNumber.current) setSaving(false);
    }
  }, [store]);

  const validate = useCallback((value: RepairWorkOrder | null) => {
    if (value && (value.vehicleId !== context.vehicleId || value.inspectionId !== context.inspectionId)) {
      throw new Error("The repair does not match this inspection and vehicle. Reopen the report.");
    }
    return value;
  }, [context.vehicleId, context.inspectionId]);

  const readServer = useCallback(async () => {
    const workOrderId = current.current.workOrderId ?? current.current.pendingAction?.workOrderId;
    const value = validate(workOrderId ? await getRepair(workOrderId) : await getInspectionRepair(context.inspectionId));
    if (active.current) { setRepair(value); setVerified(true); setServerError(null); }
    if (value && current.current.workOrderId !== value.id) {
      await persist({ ...current.current, workOrderId: value.id, updatedAt: Date.now() });
    }
    if (value?.repairStatus === "RETURNED_FOR_CORRECTION" && current.current.correctionVersion !== value.version) {
      await persist({
        ...current.current,
        workOrderId: value.id,
        notes: value.notes,
        estimatedTotal: estimateText(value.estimatedTotalCentavos),
        correctionVersion: value.version,
        updatedAt: Date.now(),
      });
    }
    return value;
  }, [context.inspectionId, persist, validate]);

  useEffect(() => {
    active.current = true;
    setLoading(true); setReady(false); setVerified(false);
    void (async () => {
      try {
        const saved = await store.read();
        if (!active.current) return;
        current.current = saved ?? emptyRepairDraft(context);
        setDraft(current.current); setReady(true);
      } catch (error) {
        if (active.current) setLocalError(message(error));
        return;
      }
      try { await readServer(); }
      catch (error) { if (active.current) { setVerified(false); setServerError(message(error)); } }
    })().finally(() => { if (active.current) setLoading(false); });
    const background = AppState.addEventListener("change", (state) => {
      if (state !== "active") void store.flush().catch(() => undefined);
    });
    return () => { active.current = false; background.remove(); };
  }, [store, readServer]);

  const edit = useCallback((changes: Partial<Pick<RepairDraft, "notes" | "estimatedTotal" | "completionNotes" | "completedWorkNotes" | "stopReason">>) => {
    if (!ready || executing.current || current.current.pendingAction) return;
    void persist({ ...current.current, ...changes, updatedAt: Date.now() }).catch(() => undefined);
  }, [persist, ready]);

  const refresh = useCallback(async () => {
    if (!ready || executing.current) return;
    setLoading(true);
    try { await readServer(); }
    catch (error) { setVerified(false); setServerError(message(error)); }
    finally { if (active.current) setLoading(false); }
  }, [readServer, ready]);

  const execute = useCallback(async (request: PendingRepairAction, recovery = false) => {
    if (executing.current || !ready) return;
    executing.current = true; setBusy(true); setServerError(null);
    let sent = false;
    try {
      await store.flush();
      // Recover accepted state before replaying an uncertain request, using the
      // original operation identity and original payload rather than new inputs.
      if (recovery) await readServer();
      await persist({ ...current.current, pendingAction: request, updatedAt: Date.now() });
      sent = true;
      const result = validate(await sendRepairAction(context.inspectionId, request));
      if (!result) throw new Error("The repair service did not return the accepted repair.");
      if (active.current) { setRepair(result); setVerified(true); }
      await persist({ ...current.current, workOrderId: result.id, pendingAction: undefined, updatedAt: Date.now() });
    } catch (error) {
      if (!active.current) return;
      const definiteRejection = sent && error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (definiteRejection) {
        await persist({ ...current.current, pendingAction: undefined, updatedAt: Date.now() }).catch(() => undefined);
        await readServer().catch(() => { setVerified(false); });
      } else if (sent) {
        setVerified(false);
      }
      setServerError(message(error));
    } finally {
      executing.current = false;
      if (active.current) setBusy(false);
    }
  }, [context.inspectionId, persist, readServer, ready, store, validate]);

  const start = useCallback(async () => {
    const value = current.current;
    const total = parseRepairEstimate(value.estimatedTotal);
    if (!verified || repair || !value.notes.trim() || total === null || value.pendingAction) return;
    const operationId = randomUUID();
    await execute({ action: "start", operationId, payload: { clientUuid: operationId, notes: value.notes.trim(), estimatedTotalCentavos: total } });
  }, [execute, repair, verified]);

  const complete = useCallback(async (rechecked: boolean) => {
    if (!verified || !repair || !rechecked || current.current.pendingAction) return;
    const operationId = randomUUID();
    await execute({ action: "complete", operationId, workOrderId: repair.id, expectedVersion: repair.version, payload: {
      operationId, expectedVersion: repair.version, rechecked: true, completionNotes: current.current.completionNotes.trim() || undefined,
    } });
  }, [execute, repair, verified]);

  const updateReturned = useCallback(async () => {
    const value = current.current;
    const total = parseRepairEstimate(value.estimatedTotal);
    if (!verified || !repair || repair.repairStatus !== "RETURNED_FOR_CORRECTION" || !value.notes.trim() || total === null || value.pendingAction) return;
    const operationId = randomUUID();
    await execute({ action: "update", operationId, workOrderId: repair.id, expectedVersion: repair.version, payload: {
      operationId, expectedVersion: repair.version, notes: value.notes.trim(), estimatedTotalCentavos: total,
    } });
  }, [execute, repair, verified]);

  const scheduleReturn = useCallback(async (slot: RepairReturnSlot) => {
    if (!verified || !repair || repair.repairStatus !== "IN_PROGRESS" || repair.returnScheduledStart || !repair.serviceTypeId || current.current.pendingAction || executing.current) return;
    executing.current = true; setBusy(true); setServerError(null);
    try {
      const holdId = await acquireRepairReturnHold(slot);
      executing.current = false; setBusy(false);
      const operationId = randomUUID();
      await execute({ action: "schedule-return", operationId, workOrderId: repair.id, expectedVersion: repair.version, payload: {
        operationId, expectedVersion: repair.version, holdId,
      } });
    } catch (error) {
      if (active.current) setServerError(message(error));
    } finally {
      executing.current = false;
      if (active.current) setBusy(false);
    }
  }, [execute, repair, verified]);

  const stop = useCallback(async () => {
    const value = current.current;
    if (!verified || !repair || !value.completedWorkNotes.trim() || !value.stopReason.trim() || value.pendingAction) return;
    const operationId = randomUUID();
    await execute({ action: "stop", operationId, workOrderId: repair.id, expectedVersion: repair.version, payload: {
      operationId, expectedVersion: repair.version, completedWorkNotes: value.completedWorkNotes.trim(), reason: value.stopReason.trim(),
    } });
  }, [execute, repair, verified]);

  const retry = useCallback(async () => {
    if (current.current.pendingAction) await execute(current.current.pendingAction, true);
  }, [execute]);

  return { draft, repair, loading, ready, verified, busy, saving, localError, serverError, edit, refresh, start, updateReturned, scheduleReturn, complete, stop, retry,
    flush: () => store.flush(), saveAgain: () => persist({ ...current.current, updatedAt: Date.now() }) };
}
