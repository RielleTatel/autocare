import type { SQLiteDatabase } from "expo-sqlite";
import { getDb } from "../../shared/db/schema";

export type RepairContext = { vehicleId: string; inspectionId: string };
export type RepairAction = "start" | "update" | "schedule-return" | "complete" | "stop";

/** An interrupted online request is retained for explicit recovery/replay only.
 * It is never consumed by the inspection sync outbox. */
export type PendingRepairAction = {
  action: RepairAction;
  operationId: string;
  workOrderId?: string;
  expectedVersion?: number;
  payload: Record<string, unknown>;
};

export type RepairDraft = RepairContext & {
  notes: string;
  estimatedTotal: string;
  completionNotes: string;
  completedWorkNotes: string;
  stopReason: string;
  workOrderId?: string;
  correctionVersion?: number;
  pendingAction?: PendingRepairAction;
  updatedAt: number;
};

export function emptyRepairDraft(context: RepairContext): RepairDraft {
  return { ...context, notes: "", estimatedTotal: "", completionNotes: "", completedWorkNotes: "", stopReason: "", updatedAt: Date.now() };
}

/** Parse decimal PHP without floating-point multiplication or rounding. */
export function parseRepairEstimate(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const centavos = whole * 100 + fraction;
  return Number.isSafeInteger(centavos) && centavos >= 0 && centavos <= 100_000_000 ? centavos : null;
}

export function estimateText(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

export function repairPeso(centavos: number): string {
  return `₱${estimateText(centavos).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** Capture the account/backend database at construction, so an in-flight save
 * cannot cross into a later sign-in's storage context. */
export class RepairDraftStore {
  private readonly db: Promise<SQLiteDatabase>;
  private readonly key: string;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly context: RepairContext) {
    this.db = getDb();
    this.key = `repair-draft:${context.vehicleId}:${context.inspectionId}`;
  }

  async read(): Promise<RepairDraft | null> {
    await this.writes;
    const db = await this.db;
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", this.key);
    if (!row) return null;
    const saved: unknown = JSON.parse(row.value);
    if (!saved || typeof saved !== "object") throw new Error("The saved repair draft could not be read.");
    const draft = saved as Partial<RepairDraft>;
    if (draft.vehicleId !== this.context.vehicleId || draft.inspectionId !== this.context.inspectionId ||
      typeof draft.notes !== "string" || typeof draft.estimatedTotal !== "string") {
      throw new Error("The saved repair draft does not match this inspection.");
    }
    return { ...emptyRepairDraft(this.context), ...draft } as RepairDraft;
  }

  save(draft: RepairDraft): Promise<void> {
    if (draft.vehicleId !== this.context.vehicleId || draft.inspectionId !== this.context.inspectionId) {
      return Promise.reject(new Error("The repair draft does not match this inspection."));
    }
    const value = JSON.stringify(draft);
    const write = this.writes.catch(() => undefined).then(async () => {
      const db = await this.db;
      await db.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", this.key, value);
    });
    this.writes = write;
    return write;
  }

  async flush(): Promise<void> { await this.writes; }
}
