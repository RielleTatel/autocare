import type {
  DrainReport, OutboxRepo, PhotoUploader, SyncStatusSnapshot, SyncTransport,
} from "./types";

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 900_000; // 15 min

/** Exponential backoff for the nth retry (attempts ≥ 1): 30s·2ⁿ⁻¹, cap 15 min. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

interface Deps {
  outbox: OutboxRepo;
  transport: SyncTransport;
  photos?: PhotoUploader;
  now?: () => number;
}

/** Drains the offline outbox to POST /sync/batch in strict enqueue order.
 *  Server receipts decide the outcome per item: APPLIED/DUPLICATE → synced,
 *  REJECTED → parked (never blocks later items). Network failures increment
 *  a per-item attempt counter that gates retries behind exponential backoff. */
export class SyncProcessor {
  private draining = false;
  private lastSyncAt: number | null = null;
  private lastError: string | null = null;
  private listeners = new Set<(s: SyncStatusSnapshot) => void>();

  constructor(private deps: Deps) {}

  subscribe(cb: (s: SyncStatusSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async snapshot(): Promise<SyncStatusSnapshot> {
    const counts = await this.deps.outbox.counts();
    return { pendingCount: counts.pending, rejectedCount: counts.rejected, lastSyncAt: this.lastSyncAt, isDraining: this.draining, lastError: this.lastError };
  }

  /** Re-broadcast the snapshot after the outbox was mutated outside a drain
   *  (e.g. a screen discarding a rejected entry), so subscribed counts follow. */
  async refreshStatus(): Promise<void> {
    await this.notify();
  }

  private async notify(): Promise<void> {
    const snap = await this.snapshot();
    for (const cb of this.listeners) cb(snap);
  }

  async drain(): Promise<DrainReport> {
    const report: DrainReport = { alreadyDraining: false, sent: 0, applied: 0, duplicates: 0, rejected: 0, deferred: 0, failed: 0, photosUploaded: 0 };
    if (this.draining) {
      return { ...report, alreadyDraining: true };
    }
    this.draining = true;
    await this.notify();
    try {
      const now = (this.deps.now ?? Date.now)();
      const pending = await this.deps.outbox.pendingInOrder();
      const eligible = pending.filter((e) => e.attempts === 0 || (e.lastAttemptAt ?? 0) + backoffMs(e.attempts) <= now);
      report.deferred = pending.length - eligible.length;
      if (eligible.length === 0) return report;

      const items = eligible.map((e) => ({ clientUuid: e.clientUuid, entityType: e.entityType, op: e.op, payload: e.payload }));
      let results;
      try {
        results = await this.deps.transport.syncBatch(items);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const e of eligible) await this.deps.outbox.recordAttempt(e.clientUuid, now, msg);
        this.lastError = msg;
        report.failed = eligible.length;
        return report;
      }
      report.sent = items.length;
      this.lastError = null;

      const byUuid = new Map(results.map((r) => [r.clientUuid, r]));
      for (const e of eligible) {
        const r = byUuid.get(e.clientUuid);
        if (!r) {
          await this.deps.outbox.recordAttempt(e.clientUuid, now, "no receipt in batch response");
          report.failed += 1;
          continue;
        }
        if (r.status === "APPLIED" || r.status === "DUPLICATE") {
          await this.deps.outbox.markSynced(e.clientUuid);
          if (r.status === "APPLIED") report.applied += 1;
          else report.duplicates += 1;
          if (this.deps.photos) {
            const p = await this.deps.photos.uploadFor(e.clientUuid);
            report.photosUploaded += p.uploaded;
          }
        } else {
          await this.deps.outbox.markRejected(e.clientUuid, `${r.error?.code ?? "REJECTED"}: ${r.error?.message ?? ""}`);
          report.rejected += 1;
        }
      }
      this.lastSyncAt = now;
      return report;
    } finally {
      this.draining = false;
      await this.notify();
    }
  }
}
