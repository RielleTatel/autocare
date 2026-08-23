import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { fieldTheme } from "../../theme";
import { InspectionsRepo } from "../../shared/db/inspections.repo";
import { outbox, syncProcessor } from "../../shared/sync";
import { queuePhoto } from "../../shared/sync/photos";
import { useInspectionDraft } from "./useInspectionDraft";
import type { CachedChecklist, DraftDeps } from "./draft";
import { getActiveChecklist } from "./checklistCache";
import { TaskDetailScreen, type FieldVehicle } from "./TaskDetailScreen";
import { CategoryNavScreen } from "./CategoryNavScreen";
import { PointEntryScreen } from "./PointEntryScreen";
import { PhotoAnnotateScreen } from "./PhotoAnnotateScreen";
import { ReviewSubmitScreen } from "./ReviewSubmitScreen";

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
  | { name: "photo"; forPoint: string }
  | { name: "review" };

/** F-04 → F-08 in one stateful flow. Navigation between capture steps is local
 *  state (the flow is one logical task), the outer stack hosts the flow. */
export function InspectionFlow({ onDone }: { onDone(): void }) {
  const t = fieldTheme;
  const [route, setRoute] = useState<Route>({ name: "task" });
  const [checklist, setChecklist] = useState<CachedChecklist | null>(null);
  const [vehicle, setVehicle] = useState<FieldVehicle | null>(null);
  const [odometerKm, setOdometerKm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveChecklist().then(setChecklist).catch((e) => setError(e instanceof Error ? e.message : "checklist unavailable"));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
        <Text style={[t.text("body"), { color: t.colors.danger, textAlign: "center" }]}>{error}</Text>
      </View>
    );
  }

  if (route.name === "task" || !vehicle || !checklist) {
    return (
      <TaskDetailScreen
        onStart={(v, odo) => {
          setVehicle(v);
          setOdometerKm(odo);
          setRoute({ name: "categories" });
        }}
      />
    );
  }

  return (
    <CaptureFlow
      checklist={checklist}
      vehicle={vehicle}
      odometerKm={odometerKm}
      route={route}
      setRoute={setRoute}
      onDone={onDone}
    />
  );
}

function CaptureFlow({
  checklist, vehicle, odometerKm, route, setRoute, onDone,
}: {
  checklist: CachedChecklist;
  vehicle: FieldVehicle;
  odometerKm: number | null;
  route: Route;
  setRoute(r: Route): void;
  onDone(): void;
}) {
  const t = fieldTheme;
  const draft = useInspectionDraft(draftDeps, { vehicleId: vehicle.id, odometerKm, checklist });

  const orderedCodes = useMemo(() => checklist.categories.flatMap((c) => c.points.map((p) => p.code)), [checklist]);
  const pointByCode = useMemo(() => {
    const m = new Map(checklist.categories.flatMap((c) => c.points.map((p) => [p.code, p] as const)));
    return m;
  }, [checklist]);

  const nextAfter = useCallback((code: string): Route => {
    const idx = orderedCodes.indexOf(code);
    const next = orderedCodes[idx + 1];
    return next ? { name: "point", code: next } : { name: "review" };
  }, [orderedCodes]);

  if (!draft.draft) {
    return <View style={{ flex: 1, backgroundColor: t.colors.chassis }} />;
  }

  if (route.name === "photo") {
    return (
      <PhotoAnnotateScreen
        onCancel={() => setRoute({ name: "point", code: route.forPoint })}
        onDone={async (uri) => {
          const existing = draft.results.find((r) => r.pointCode === route.forPoint);
          await draft.saveResult({
            pointCode: route.forPoint,
            status: existing?.status,
            measuredValue: existing?.measuredValue,
            notes: existing?.notes,
            photoUris: [...(existing?.photoUris ?? []), uri],
          });
          await queuePhoto(randomUUID(), draft.draft!.clientUuid, uri);
          setRoute({ name: "point", code: route.forPoint });
        }}
      />
    );
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
        onSave={(r) => { void draft.saveResult(r); }}
        onAddPhoto={() => setRoute({ name: "photo", forPoint: route.code })}
        onNext={() => setRoute(nextAfter(route.code))}
      />
    );
  }

  if (route.name === "review") {
    return (
      <ReviewSubmitScreen
        checklist={checklist}
        results={draft.results}
        check={draft.check ?? { complete: false, missingPoints: [], missingPhotos: [] }}
        overall={draft.overall}
        submitted={draft.isLocked}
        isOffline
        onJumpToPoint={(code) => setRoute({ name: "point", code })}
        onSubmit={async () => {
          await draft.submit();
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
      onOpenCategory={(code) => setRoute({ name: "point", code: firstUnansweredIn(code) })}
      onReview={() => setRoute({ name: "review" })}
    />
  );
}
