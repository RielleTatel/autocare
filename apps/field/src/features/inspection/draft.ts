import { deriveStatus } from "@autocare/scoring";
import type { ChecklistConfig, ConfigCategory, ConfigPoint, PointStatus } from "@autocare/scoring";
import type { LocalResult } from "../../shared/db/inspections.repo";
import type { OutboxRepo } from "../../shared/sync/types";

/** The cached GET /checklists/active payload the draft snapshots at start.
 *  Checklist versions are immutable, so the snapshot never shifts mid-capture. */
export interface CachedChecklist {
  id: string;
  versionLabel: string;
  weightVersion: string;
  categories: ChecklistConfig["categories"];
}

export interface DraftInspectionsStore {
  createDraft(d: {
    clientUuid: string; vehicleId: string; appointmentId: string | null;
    checklistVersionId: string; checklistJson: string; odometerKm: number | null;
    notes: string | null; startedAt: number;
  }): Promise<void>;
  saveResult(inspectionClientUuid: string, r: LocalResult): Promise<void>;
  results(inspectionClientUuid: string): Promise<LocalResult[]>;
  lock(clientUuid: string, submittedAt: number): Promise<void>;
}

export interface DraftDeps {
  inspections: DraftInspectionsStore;
  outbox: OutboxRepo;
  uuid: () => string;
  now: () => number;
}

const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

export interface CategoryProgress {
  code: string;
  label: string;
  answered: number;
  total: number;
  /** Worst answered status in the category — drives the F-05 tile accent. */
  worst: PointStatus | null;
}

export interface Completeness {
  complete: boolean;
  missingPoints: string[];
  /** Adverse findings whose point requires a photo but has none yet. */
  missingPhotos: string[];
}

const SEVERITY: Record<PointStatus, number> = { NOT_APPLICABLE: 0, GOOD: 1, MONITOR: 2, ATTENTION: 3, CRITICAL: 4 };

export function allPoints(checklist: CachedChecklist): Array<{ category: ConfigCategory; point: ConfigPoint }> {
  return checklist.categories.flatMap((category) => category.points.map((point) => ({ category, point })));
}

export function categoryProgress(checklist: CachedChecklist, results: LocalResult[]): CategoryProgress[] {
  const byCode = new Map(results.map((r) => [r.pointCode, r]));
  return checklist.categories.map((cat) => {
    let answered = 0;
    let worst: PointStatus | null = null;
    for (const p of cat.points) {
      const r = byCode.get(p.code);
      const status = resolveStatus(p, r);
      if (status !== undefined) {
        answered += 1;
        if (worst === null || SEVERITY[status] > SEVERITY[worst]) worst = status;
      }
    }
    return { code: cat.code, label: cat.label, answered, total: cat.points.length, worst };
  });
}

export function overallProgress(checklist: CachedChecklist, results: LocalResult[]): { answered: number; total: number } {
  const per = categoryProgress(checklist, results);
  return { answered: per.reduce((s, c) => s + c.answered, 0), total: per.reduce((s, c) => s + c.total, 0) };
}

/** Same precedence as the server engine: a measured value derives its status
 *  from thresholds; a bare status is the offline fallback. */
function resolveStatus(p: ConfigPoint, r: LocalResult | undefined): PointStatus | undefined {
  if (!r) return undefined;
  if (p.inputType === "MEASURED" && r.measuredValue !== undefined && p.thresholds) {
    return deriveStatus(r.measuredValue, p.thresholds);
  }
  return r.status as PointStatus | undefined;
}

export function completeness(checklist: CachedChecklist, results: LocalResult[]): Completeness {
  const byCode = new Map(results.map((r) => [r.pointCode, r]));
  const missingPoints: string[] = [];
  const missingPhotos: string[] = [];
  for (const { point } of allPoints(checklist)) {
    const r = byCode.get(point.code);
    const status = resolveStatus(point, r);
    if (status === undefined) {
      missingPoints.push(point.code);
      continue;
    }
    if (point.requiresPhotoOnAdverse && ADVERSE.includes(status) && r!.photoUris.length === 0) {
      missingPhotos.push(point.code);
    }
  }
  return { complete: missingPoints.length === 0 && missingPhotos.length === 0, missingPoints, missingPhotos };
}

/** Orchestrates one inspection draft: snapshot → capture → review → submit.
 *  Pure over its injected stores, so jest exercises it with memory fakes. */
export class InspectionDraft {
  readonly clientUuid: string;
  private submitted = false;

  private constructor(
    private deps: DraftDeps,
    clientUuid: string,
    readonly checklist: CachedChecklist,
    readonly vehicleId: string,
    readonly odometerKm: number | null,
  ) {
    this.clientUuid = clientUuid;
  }

  static async start(
    deps: DraftDeps,
    input: { vehicleId: string; appointmentId?: string | null; odometerKm?: number | null; checklist: CachedChecklist },
  ): Promise<InspectionDraft> {
    const clientUuid = deps.uuid();
    await deps.inspections.createDraft({
      clientUuid,
      vehicleId: input.vehicleId,
      appointmentId: input.appointmentId ?? null,
      checklistVersionId: input.checklist.id,
      checklistJson: JSON.stringify(input.checklist),
      odometerKm: input.odometerKm ?? null,
      notes: null,
      startedAt: deps.now(),
    });
    return new InspectionDraft(deps, clientUuid, input.checklist, input.vehicleId, input.odometerKm ?? null);
  }

  get isLocked(): boolean {
    return this.submitted;
  }

  async saveResult(r: LocalResult): Promise<void> {
    if (this.submitted) throw new Error("draft is locked after submission");
    await this.deps.inspections.saveResult(this.clientUuid, r);
  }

  results(): Promise<LocalResult[]> {
    return this.deps.inspections.results(this.clientUuid);
  }

  async progress(): Promise<{ perCategory: CategoryProgress[]; overall: { answered: number; total: number } }> {
    const results = await this.results();
    return { perCategory: categoryProgress(this.checklist, results), overall: overallProgress(this.checklist, results) };
  }

  async completeness(): Promise<Completeness> {
    return completeness(this.checklist, await this.results());
  }

  /** Refuses while incomplete; then enqueues create + submit outbox entries and locks. */
  async submit(): Promise<{ createUuid: string; submitUuid: string }> {
    if (this.submitted) throw new Error("draft is locked after submission");
    const check = await this.completeness();
    if (!check.complete) {
      throw new Error(`inspection incomplete: ${[...check.missingPoints, ...check.missingPhotos].join(", ")}`);
    }
    const results = await this.results();
    const submittedAt = new Date(this.deps.now()).toISOString();
    await this.deps.outbox.enqueue({
      clientUuid: this.clientUuid,
      entityType: "inspection",
      op: "create",
      payload: {
        vehicleId: this.vehicleId,
        checklistVersionId: this.checklist.id,
        odometerKm: this.odometerKm ?? undefined,
        results: results.map((r) => ({
          pointCode: r.pointCode,
          status: r.status,
          measuredValue: r.measuredValue,
          notes: r.notes,
        })),
      },
    });
    const submitUuid = this.deps.uuid();
    await this.deps.outbox.enqueue({
      clientUuid: submitUuid,
      entityType: "inspection",
      op: "submit",
      payload: { inspectionClientUuid: this.clientUuid, submittedAt },
    });
    await this.deps.inspections.lock(this.clientUuid, this.deps.now());
    this.submitted = true;
    return { createUuid: this.clientUuid, submitUuid };
  }
}
