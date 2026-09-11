import { InspectionDraft, type CachedChecklist, type DraftDeps } from "./draft";
import { MemoryInspectionsStore } from "./memory-inspections.store";
import { MemoryOutboxRepo } from "../../shared/db/memory-outbox.repo";

const checklist: CachedChecklist = {
  id: "version-1",
  versionLabel: "v1.0",
  weightVersion: "w1.0",
  categories: [
    {
      code: "BRAKES", label: "Brakes", weight: 60,
      points: [
        { code: "PAD", label: "Front pads", weightInCategory: 50, isSafetyCritical: true, inputType: "MEASURED", unit: "mm", thresholds: { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }, recommendation: "replace", requiresPhotoOnAdverse: true },
        { code: "DISC", label: "Discs", weightInCategory: 50, isSafetyCritical: true, inputType: "STATUS", recommendation: "machine", requiresPhotoOnAdverse: true },
      ],
    },
    {
      code: "LIGHTS", label: "Lights", weight: 40,
      points: [{ code: "HEAD", label: "Headlights", weightInCategory: 100, isSafetyCritical: false, inputType: "STATUS", recommendation: "replace bulb" }],
    },
  ],
};

function makeDeps() {
  let n = 0;
  const inspections = new MemoryInspectionsStore();
  const outbox = new MemoryOutboxRepo();
  const deps: DraftDeps = { inspections, outbox, uuid: () => `uuid-${++n}`, now: () => 1_700_000_000_000 };
  return { deps, inspections, outbox };
}

describe("InspectionDraft", () => {
  it("starting a draft snapshots the cached checklist version", async () => {
    const { deps, inspections } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", checklist });
    const stored = inspections.drafts.get(draft.clientUuid)!;
    expect(stored.checklistVersionId).toBe("version-1");
    expect(JSON.parse(stored.checklistJson).versionLabel).toBe("v1.0");
  });

  it("tracks progress per category and overall, deriving measured statuses", async () => {
    const { deps } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", checklist });
    await draft.saveResult({ pointCode: "PAD", measuredValue: 3.0, photoUris: [] }); // → ATTENTION
    const { perCategory, overall } = await draft.progress();
    expect(overall).toEqual({ answered: 1, total: 3 });
    const brakes = perCategory.find((c) => c.code === "BRAKES")!;
    expect(brakes).toMatchObject({ answered: 1, total: 2, worst: "ATTENTION" });
  });

  it("completeness lists missing points and adverse points missing required photos", async () => {
    const { deps } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", checklist });
    await draft.saveResult({ pointCode: "PAD", measuredValue: 3.0, photoUris: [] }); // adverse, photo required
    await draft.saveResult({ pointCode: "DISC", status: "GOOD", photoUris: [] });
    const check = await draft.completeness();
    expect(check.complete).toBe(false);
    expect(check.missingPoints).toEqual(["HEAD"]);
    expect(check.missingPhotos).toEqual(["PAD"]);
  });

  it("submit refuses while incomplete", async () => {
    const { deps, outbox } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", checklist });
    await expect(draft.submit()).rejects.toThrow(/incomplete/);
    expect(await outbox.counts()).toEqual({ pending: 0, rejected: 0 });
  });

  it("submit writes create + submit outbox entries in order and locks the draft", async () => {
    const { deps, outbox, inspections } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", odometerKm: 42_000, checklist });
    await draft.saveResult({ pointCode: "PAD", measuredValue: 8.0, photoUris: [] }); // GOOD, no photo needed
    await draft.saveResult({ pointCode: "DISC", status: "GOOD", photoUris: [] });
    await draft.saveResult({ pointCode: "HEAD", status: "MONITOR", photoUris: [] });
    await draft.submit();

    const pending = await outbox.pendingInOrder();
    expect(pending.map((e) => e.op)).toEqual(["create", "submit"]);
    expect(pending[0].payload).toMatchObject({ vehicleId: "veh-1", checklistVersionId: "version-1", odometerKm: 42000 });
    expect((pending[0].payload as any).results).toHaveLength(3);
    expect(pending[1].payload).toMatchObject({ inspectionClientUuid: draft.clientUuid });

    expect(inspections.drafts.get(draft.clientUuid)!.status).toBe("LOCKED");
    expect(draft.isLocked).toBe(true);
    await expect(draft.saveResult({ pointCode: "HEAD", status: "GOOD", photoUris: [] })).rejects.toThrow(/locked/);
    await expect(draft.submit()).rejects.toThrow(/locked/);
  });

  it("carries appointmentId into the create payload so the booking can be completed", async () => {
    const { deps, outbox } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", appointmentId: "appt-1", odometerKm: 1, checklist });
    await draft.saveResult({ pointCode: "PAD", measuredValue: 8.0, photoUris: [] });
    await draft.saveResult({ pointCode: "DISC", status: "GOOD", photoUris: [] });
    await draft.saveResult({ pointCode: "HEAD", status: "GOOD", photoUris: [] });
    await draft.submit();

    const [create] = await outbox.pendingInOrder();
    expect(create.payload).toMatchObject({ appointmentId: "appt-1" });
  });

  it("omits appointmentId for a walk-in with no booking", async () => {
    const { deps, outbox } = makeDeps();
    const draft = await InspectionDraft.start(deps, { vehicleId: "veh-1", odometerKm: 1, checklist });
    await draft.saveResult({ pointCode: "PAD", measuredValue: 8.0, photoUris: [] });
    await draft.saveResult({ pointCode: "DISC", status: "GOOD", photoUris: [] });
    await draft.saveResult({ pointCode: "HEAD", status: "GOOD", photoUris: [] });
    await draft.submit();

    const [create] = await outbox.pendingInOrder();
    // undefined, not null — the zod payload schema has appointmentId as optional.
    expect(create.payload.appointmentId).toBeUndefined();
  });
});
