import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fieldTheme as t } from "../../theme";
import { FieldNav } from "../../components/FieldNav";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { Reference } from "../../components/References";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { api } from "../../shared/api";
import { InspectionsRepo, type LocalInspection } from "../../shared/db/inspections.repo";
import { outbox, syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import { VehicleHistory } from "../history/VehicleHistory";
import type { FieldVehicle } from "../inspection/TaskDetailScreen";
import { getBooking, manilaSchedule, type FieldTask } from "./tasksApi";
import { bookingStatusLabel, bookingTone } from "./TaskListScreen";
export { Reference } from "../../components/References";
const repo = new InspectionsRepo();
export type InspectionSetup = { vehicle: FieldVehicle; odometerKm: number | null };
export const canStartInspection = (task: FieldTask): boolean => Boolean(task.inspectionRequired && task.canInspect && ["BOOKED", "CONFIRMED"].includes(task.status) && !task.inspectionId);

export function BookingDetailScreen({ task: initialTask, onBack, onStart, onOpenSyncQueue, onOpenReport }: {
  task: FieldTask; onBack(): void; onStart(task: FieldTask, setup?: InspectionSetup): void; onOpenSyncQueue(): void;
  onOpenReport(vehicleId: string, inspectionId: string): void;
}) {
  const sync = useSyncStatus(syncProcessor);
  const [task, setTask] = useState(initialTask);
  const [draft, setDraft] = useState<LocalInspection | null>(null);
  const [vehicle, setVehicle] = useState<FieldVehicle | null>(null);
  const [odometer, setOdometer] = useState("");
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const opening = useRef(false);
  const load = useCallback(async () => {
    opening.current = false; setLoading(true); setError(null); setVehicleError(null);
    try {
      const [fresh, local, rejected] = await Promise.all([getBooking(initialTask.id).catch((e) => { setError(e instanceof Error ? e.message : "Could not refresh this booking."); return initialTask; }), repo.findByBooking(initialTask.id), outbox.rejectedInOrder()]);
      setTask(fresh); setDraft(local);
      setQueueError(local ? rejected.find((r) => r.clientUuid === local.clientUuid || r.payload.inspectionClientUuid === local.clientUuid)?.lastError ?? null : null);
      if (!local && canStartInspection(fresh)) {
        try {
          const booked = await api.get<FieldVehicle>(`/vehicles/${encodeURIComponent(fresh.vehicleId)}`);
          if (booked.id !== fresh.vehicleId) throw new Error("The vehicle does not match this booking. Refresh and try again.");
          setVehicle(booked); setOdometer(String(booked.currentOdometerKm));
        } catch (e) { setVehicle(null); setVehicleError(e instanceof Error ? e.message : "Could not load the booked vehicle."); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not refresh this booking."); }
    finally { setLoading(false); }
  }, [initialTask.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { if (sync.lastSyncAt) void load(); }, [sync.lastSyncAt, load]);
  const odometerValid = odometer.trim() === "" || /^\d+$/.test(odometer.trim()) && Number.isSafeInteger(Number(odometer));
  const start = () => {
    if (opening.current) return;
    if (draft) { opening.current = true; onStart(task); }
    else if (vehicle && odometerValid) { opening.current = true; onStart(task, { vehicle, odometerKm: odometer.trim() === "" ? null : Number(odometer) }); }
  };
  const newStart = !draft && !task.inspectionId && !error && canStartInspection(task);
  const resume = draft?.status === "DRAFT" && !task.inspectionId && task.canInspect;
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Booking details" onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={workContent}>
      {error ? <EmptyState tone="error" title="Showing the booking you opened" body={`${error} Reconnect and refresh before starting work.`} action={<Button variant="secondary" onPress={() => void load()}>Refresh booking</Button>} /> : null}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}><Plate variant="plain">{task.vehiclePlateNo}</Plate><StatusPill tone={bookingTone(task.status)}>{bookingStatusLabel(task.status)}</StatusPill></View>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{[task.vehicleMake, task.vehicleModel, task.vehicleYear].filter(Boolean).join(" ")}</Text>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>{task.serviceTypeName}</Text>
      </View>
      <View style={{ gap: 8, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.colors.line }}>
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Scheduled · Philippine time</Text>
        <Text style={[t.text("body", 600), { color: t.colors.ink }]}>{manilaSchedule(task.scheduledStart)}</Text>
        {task.scheduledEnd ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Until {manilaSchedule(task.scheduledEnd)}</Text> : null}
        {task.bayName || task.requiresPickup ? <Text style={[t.text("body"), { color: t.colors.ink }]}>{[task.bayName ? `Bay: ${task.bayName}` : null, task.requiresPickup ? "Pickup requested" : null].filter(Boolean).join(" · ")}</Text> : null}
        {task.memberName ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{task.memberName}</Text> : null}
      </View>
      {task.inspectionId ? <>
        {task.status === "CANCELLED" ? <Text style={[t.text("body"), { color: t.colors.danger }]}>A report was accepted for this cancelled booking. The booking remains cancelled; ask an advisor to review the conflict.</Text> : null}
        {task.scorePending ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Report accepted. Health score calculation is pending.</Text> : <Text style={[t.text("body"), { color: t.colors.success }]}>Inspection report accepted.</Text>}
      </> : draft?.status === "LOCKED" ? <Card style={{ gap: 8 }}>
        <Text style={[t.text("h2"), { color: queueError ? t.colors.danger : t.colors.ink }]}>{queueError ? "Submission needs attention" : "Pending sync"}</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{queueError ?? "Saved on this device. This booking is complete only after the server accepts the report."}</Text>
        {!queueError ? <Button variant="ghost" block={false} onPress={onOpenSyncQueue}>Open sync queue</Button> : null}
      </Card> : draft ? <>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Your unfinished inspection is saved on this device.</Text>
        {["CANCELLED", "NO_SHOW"].includes(task.status) ? <Text style={[t.text("body"), { color: t.colors.danger }]}>The booking status changed. Existing work can be reviewed; a cancellation stays cancelled after report acceptance.</Text> : null}
      </> : newStart ? <View style={{ gap: 8 }}>
        <Text style={[t.text("body", 600), { color: t.colors.ink }]}>Odometer (km)</Text>
        <TextInput accessibilityLabel="Odometer reading" keyboardType="number-pad" value={odometer} onChangeText={setOdometer} placeholder="Enter current reading" style={{ ...t.text("code"), minHeight: t.minTarget, paddingHorizontal: 16, borderWidth: 1, borderColor: odometerValid ? t.colors.line : t.colors.danger, borderRadius: t.radii.sm, backgroundColor: t.colors.surface, color: t.colors.ink }} />
        <Text style={[t.text("label"), { color: odometerValid ? t.colors.inkMuted : t.colors.danger }]}>{odometerValid ? "Confirm the current reading. The booked vehicle stays fixed." : "Enter a whole number of kilometres, or leave it empty."}</Text>
        {vehicleError ? <EmptyState tone="error" title="Could not load booked vehicle" body={vehicleError} action={<Button variant="secondary" onPress={() => void load()}>Try again</Button>} /> : null}
      </View> : !loading && !error ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{!task.inspectionRequired ? "This service does not require an inspection." : !task.canInspect ? "Inspection requires an authorized, certified staff member." : "This booking does not allow a new inspection."}</Text> : null}
      {loading ? <EmptyState tone="loading" title="Refreshing booking…" /> : null}
      {newStart && vehicle ? <Disclosure title="Previous inspections"><VehicleHistory vehicleId={vehicle.id} onOpenInspection={(id) => onOpenReport(vehicle.id, id)} /></Disclosure> : null}
      <Disclosure title="References">
        <Reference label="Booking ID" value={task.id} />
        {task.inspectionId ? <Reference label="Inspection ID" value={task.inspectionId} /> : null}
        {draft ? <Reference label="Local draft reference" value={draft.clientUuid} /> : null}
      </Disclosure>
    </ScrollView>
    {task.inspectionId ? <ActionBar><Button onPress={() => onOpenReport(task.vehicleId, task.inspectionId!)}>View report</Button></ActionBar>
      : draft?.status === "LOCKED" ? <ActionBar><Button disabled={sync.isDraining} onPress={queueError ? onOpenSyncQueue : () => { void syncProcessor.drain({ force: true }); }}>{queueError ? "Review sync issue" : "Retry sync"}</Button></ActionBar>
      : resume ? <ActionBar hint="Continue with the same saved inspection."><Button disabled={loading} onPress={start}>Resume inspection</Button></ActionBar>
      : newStart ? <ActionBar hint="You may start before the scheduled time."><Button disabled={loading || !vehicle || !odometerValid} onPress={start}>Start inspection</Button></ActionBar> : null}
  </View>;
}
