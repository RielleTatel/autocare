import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { fieldTheme } from "../../theme";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { kvGet, kvSet } from "../../shared/db/kv";
import { api } from "../../shared/api";
import type { InspectionSetup } from "../tasks/BookingDetailScreen";
import { InspectionsRepo } from "../../shared/db/inspections.repo";
import { outbox, syncProcessor } from "../../shared/sync";
import { queuePhoto } from "../../shared/sync/photos";
import { useInspectionDraft } from "./useInspectionDraft";
import type { CachedChecklist, DraftDeps } from "./draft";
import { getBookingChecklist } from "./checklistCache";
import { TaskDetailScreen, type FieldVehicle } from "./TaskDetailScreen";
import { CategoryNavScreen } from "./CategoryNavScreen";
import { PointEntryScreen } from "./PointEntryScreen";
import { PhotoAnnotateScreen } from "./PhotoAnnotateScreen";
import { ReviewSubmitScreen } from "./ReviewSubmitScreen";
import { AdditionalFindingsScreen } from "./AdditionalFindingsScreen";

const inspectionsRepo = new InspectionsRepo();
const draftDeps: DraftDeps = {
  inspections: inspectionsRepo,
  outbox,
  uuid: () => randomUUID(),
  now: () => Date.now(),
};

type Route =
  | { name: "task" }
  | { name: "categories" }
  | { name: "point"; code: string }
  | { name: "photo"; forPoint: string; photoClientUuid: string }
  | { name: "observationPhoto"; observationClientUuid: string; photoClientUuid: string }
  | { name: "observations" }
  | { name: "review" };

/** F-04 → F-08 in one stateful flow. Navigation between capture steps is local
 *  state (the flow is one logical task), the outer stack hosts the flow. */
export function InspectionFlow({ onDone, initialVehicleId, initialAppointmentId, onOpenInspection, scheduledStart, serviceTypeName, initialSetup }: {
  onDone(): void;
  initialVehicleId?: string;
  /** Set when the flow was opened from a booked task. Carried into the draft so
   *  the synced inspection links to its appointment (and completes it). */
  initialAppointmentId?: string;
  scheduledStart?: string;
  serviceTypeName?: string;
  initialSetup?: InspectionSetup;
  onOpenInspection?: (vehicleId: string, inspectionId: string) => void;
}) {
  const t = fieldTheme;
  const [route, setRoute] = useState<Route>(initialSetup ? { name: "categories" } : { name: "task" });
  const [checklist, setChecklist] = useState<CachedChecklist | null>(null);
  const [vehicle, setVehicle] = useState<FieldVehicle | null>(initialSetup?.vehicle ?? null);
  const [odometerKm, setOdometerKm] = useState<number | null>(initialSetup?.odometerKm ?? null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const navigation = useNavigation();
  const flushRef = useRef<() => Promise<void>>(async () => {});
  usePreventRemove(Boolean(vehicle), ({ data }) => {
    void flushRef.current().then(() => navigation.dispatch(data.action)).catch((e) => setError(e instanceof Error ? e.message : "Could not save inspection. Try again."));
  });
  const registerFlush = useCallback((flush: () => Promise<void>) => { flushRef.current = flush; }, []);

  useEffect(() => {
    if (!initialVehicleId || !initialAppointmentId) return;
    let mounted = true;
    setRestoring(true);
    void (async () => {
      if (initialSetup && initialSetup.vehicle.id !== initialVehicleId) throw new Error("The vehicle does not match this booking. Reopen the booking.");
      const saved = await inspectionsRepo.findByBooking(initialAppointmentId);
      if (saved) {
        if (saved.status === "LOCKED") throw new Error("This inspection was submitted. Open the booking to check sync or view its report.");
        const cachedVehicle = await kvGet(`draft-vehicle:${saved.clientUuid}`);
        const bookedVehicle = cachedVehicle ? JSON.parse(cachedVehicle) as FieldVehicle : await api.get<FieldVehicle>(`/vehicles/${initialVehicleId}`);
        if (mounted) { setChecklist(JSON.parse(saved.checklistJson)); setVehicle(bookedVehicle); setOdometerKm(saved.odometerKm); setRoute({ name: "categories" }); }
      } else {
        const bookedChecklist = await getBookingChecklist(initialAppointmentId, initialVehicleId);
        if (mounted) setChecklist(bookedChecklist);
      }
    })().catch((e) => { if (mounted) setError(e instanceof Error ? e.message : "checklist unavailable"); }).finally(() => { if (mounted) setRestoring(false); });
    return () => { mounted = false; };
  }, [initialVehicleId, initialAppointmentId]);

  if (!initialVehicleId || !initialAppointmentId) {
    return (
      <EmptyState title="Choose a booking first" body="Open the vehicle's booking to start its inspection."
        action={<Button onPress={onDone}>Return to bookings</Button>} />
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
        <Text style={[t.text("body"), { color: t.colors.danger, textAlign: "center" }]}>{error}</Text>
        <Button variant="secondary" onPress={onDone}>Return to booking</Button>
      </View>
    );
  }

  if (restoring) return <EmptyState tone="loading" title="Restoring inspection…" />;

  if (route.name === "task" || !vehicle || !checklist) {
    return (
      <TaskDetailScreen
        initialVehicleId={initialVehicleId}
        appointmentId={initialAppointmentId}
        onBack={onDone}
        onOpenInspection={onOpenInspection}
        onStart={(v, odo) => {
          setVehicle(v);
          setOdometerKm(odo);
          setRoute({ name: "categories" });
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <View style={{ backgroundColor: t.colors.surface, borderBottomWidth: 1, borderColor: t.colors.lineSoft }}><View style={{ width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={[t.text("code"), { color: t.colors.ink }]}>{vehicle.plateNo}</Text>
        <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={[t.text("label"), { color: t.colors.inkMuted }]}>{checklist.serviceName ?? serviceTypeName ?? "Vehicle inspection"}</Text><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{checklist.versionLabel}{checklist.scope === "FOCUSED" ? " · Focused checks" : checklist.scope === "FULL" ? " · Full inspection" : " · Saved checklist"}</Text></View>
      </View>
      </View>
      <CaptureFlow
        checklist={checklist}
        vehicle={vehicle}
        odometerKm={odometerKm}
        appointmentId={initialAppointmentId}
        registerFlush={registerFlush}
        route={route}
        setRoute={setRoute}
        onDone={onDone}
        scheduledStart={scheduledStart}
      />
    </View>
  );
}

function CaptureFlow({
  checklist, vehicle, odometerKm, appointmentId, route, setRoute, onDone, registerFlush, scheduledStart,
}: {
  checklist: CachedChecklist;
  vehicle: FieldVehicle;
  odometerKm: number | null;
  appointmentId: string;
  route: Route;
  setRoute(r: Route): void;
  onDone(): void;
  registerFlush(flush: () => Promise<void>): void;
  scheduledStart?: string;
}) {
  const t = fieldTheme;
  const draft = useInspectionDraft(draftDeps, { vehicleId: vehicle.id, appointmentId, odometerKm, checklist });

  useEffect(() => { registerFlush(draft.flush); }, [registerFlush, draft.flush]);
  useEffect(() => {
    if (draft.draft) void kvSet(`draft-vehicle:${draft.draft.clientUuid}`, JSON.stringify(vehicle));
  }, [draft.draft, vehicle]);

  const orderedCodes = useMemo(() => checklist.categories.flatMap((c) => c.points.map((p) => p.code)), [checklist]);
  const pointByCode = useMemo(() => {
    const m = new Map(checklist.categories.flatMap((c) => c.points.map((p) => [p.code, p] as const)));
    return m;
  }, [checklist]);

  // The nav title names the category a point belongs to, so "back" has an
  // obvious destination rather than repeating the point label already below it.
  const categoryByPointCode = useMemo(() => {
    const m = new Map<string, { label: string }>();
    for (const c of checklist.categories) {
      for (const p of c.points) m.set(p.code, { label: c.label });
    }
    return m;
  }, [checklist]);
  const categoryOf = useCallback((code: string) => categoryByPointCode.get(code), [categoryByPointCode]);

  const nextAfter = useCallback((code: string): Route => {
    const idx = orderedCodes.indexOf(code);
    const next = orderedCodes[idx + 1];
    return next ? { name: "point", code: next } : { name: "review" };
  }, [orderedCodes]);

  if (!draft.draft) {
    return <EmptyState tone={draft.submitError ? "error" : "loading"} title={draft.submitError ?? "Restoring inspection…"} action={draft.submitError ? <Button onPress={onDone}>Return to booking</Button> : undefined} />;
  }

  if (route.name === "photo") {
    return (
      <PhotoAnnotateScreen
        onCancel={() => setRoute({ name: "point", code: route.forPoint })}
        onDone={async (uri) => {
          const retained = await queuePhoto(route.photoClientUuid, draft.draft!.clientUuid, uri, { type: "RESULT", pointCode: route.forPoint });
          const existing = draft.results.find((r) => r.pointCode === route.forPoint);
          await draft.saveResult({
            pointCode: route.forPoint,
            status: existing?.status,
            measuredValue: existing?.measuredValue,
            notes: existing?.notes,
            photoUris: [...new Set([...(existing?.photoUris ?? []), retained])],
          });
          setRoute({ name: "point", code: route.forPoint });
        }}
      />
    );
  }

  if (route.name === "observations") {
    return <AdditionalFindingsScreen observations={draft.observations} onSave={draft.saveObservation} onDelete={draft.deleteObservation}
      onBack={() => setRoute({ name: "categories" })} onPhoto={async (observationClientUuid) => { await draft.flush(); setRoute({ name: "observationPhoto", observationClientUuid, photoClientUuid: randomUUID() }); }} />;
  }

  if (route.name === "observationPhoto") {
    return <PhotoAnnotateScreen onCancel={() => setRoute({ name: "observations" })} onDone={async (uri) => {
      const observation = draft.observations.find((entry) => entry.clientUuid === route.observationClientUuid);
      if (!observation) throw new Error("The saved finding could not be found. Return to additional findings.");
      const retained = await queuePhoto(route.photoClientUuid, draft.draft!.clientUuid, uri, { type: "OBSERVATION", observationClientUuid: observation.clientUuid });
      await draft.saveObservation({ ...observation, photoUris: [...new Set([...observation.photoUris, retained])] });
      setRoute({ name: "observations" });
    }} />;
  }

  if (route.name === "point") {
    const point = pointByCode.get(route.code);
    if (!point) {
      setRoute({ name: "categories" });
      return null;
    }
    return (
      <PointEntryScreen
        key={route.code}
        point={point}
        initial={draft.results.find((r) => r.pointCode === route.code)}
        onSave={(r) => draft.saveResult(r)}
        onAddPhoto={() => setRoute({ name: "photo", forPoint: route.code, photoClientUuid: randomUUID() })}
        onNext={() => setRoute(nextAfter(route.code))}
        onBack={() => setRoute({ name: "categories" })}
        title={categoryOf(route.code)?.label}
        progress={draft.overall}
      />
    );
  }

  if (route.name === "review") {
    return (
      <ReviewSubmitScreen
        checklist={checklist}
        results={draft.results}
        observations={draft.observations}
        onAdditionalFindings={() => setRoute({ name: "observations" })}
        check={draft.check ?? { complete: false, missingPoints: [], missingPhotos: [] }}
        overall={draft.overall}
        submitted={draft.isLocked}
        isOffline
        vehicle={{ plateNo: vehicle.plateNo, description: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, odometerKm: odometerKm ?? undefined }}
        onJumpToPoint={(code) => setRoute({ name: "point", code })}
        onBack={() => setRoute({ name: "categories" })}
        error={draft.submitError}
        onSubmit={async () => {
          const ok = await draft.submit();
          if (!ok) return;
          void syncProcessor.drain().catch(() => undefined);
          onDone();
        }}
      />
    );
  }

  const firstUnansweredIn = (categoryCode: string): string => {
    const cat = checklist.categories.find((c) => c.code === categoryCode)!;
    const answered = new Set(draft.results.filter((r) => r.status !== undefined || r.measuredValue !== undefined).map((r) => r.pointCode));
    return (cat.points.find((p) => !answered.has(p.code)) ?? cat.points[0]).code;
  };

  return (
    <CategoryNavScreen
      perCategory={draft.perCategory}
      overall={draft.overall}
      checklist={checklist}
      results={draft.results}
      onAdditionalFindings={() => setRoute({ name: "observations" })}
      additionalFindingCount={draft.observations.filter((observation) => observation.notes.trim()).length}
      appointmentId={appointmentId}
      scheduledStart={scheduledStart}
      onOpenPoint={(code) => setRoute({ name: "point", code })}
      onOpenCategory={(code) => setRoute({ name: "point", code: firstUnansweredIn(code) })}
      onReview={() => setRoute({ name: "review" })}
      onBack={onDone}
    />
  );
}
