import type { OutboxEntry, OutboxRepo, SyncEntityType, SyncOp } from "../sync/types";

/** In-memory OutboxRepo — the behavioural reference for the SQLite repo and
 *  the implementation used by jest (expo-sqlite has no jest environment). */
export class MemoryOutboxRepo implements OutboxRepo {
  private entries: OutboxEntry[] = [];
  private seq = 0;

  async enqueue(e: { clientUuid: string; entityType: SyncEntityType; op: SyncOp; payload: Record<string, unknown> }): Promise<void> {
    // monotonically increasing createdAt even when enqueued within the same ms
    this.entries.push({ ...e, createdAt: ++this.seq, attempts: 0, state: "PENDING" });
  }

  async pendingInOrder(): Promise<OutboxEntry[]> {
    return this.entries.filter((e) => e.state === "PENDING").sort((a, b) => a.createdAt - b.createdAt).map((e) => ({ ...e }));
  }

  async markSynced(clientUuid: string): Promise<void> {
    this.mutate(clientUuid, (e) => { e.state = "SYNCED"; e.lastError = undefined; });
  }

  async markRejected(clientUuid: string, error: string): Promise<void> {
    this.mutate(clientUuid, (e) => { e.state = "REJECTED"; e.lastError = error; });
  }

  async recordAttempt(clientUuid: string, at: number, error: string): Promise<void> {
    this.mutate(clientUuid, (e) => { e.attempts += 1; e.lastAttemptAt = at; e.lastError = error; });
  }

  async rejectedInOrder(): Promise<OutboxEntry[]> {
    return this.entries.filter((e) => e.state === "REJECTED").sort((a, b) => a.createdAt - b.createdAt).map((e) => ({ ...e }));
  }

  async counts(): Promise<{ pending: number; rejected: number }> {
    return {
      pending: this.entries.filter((e) => e.state === "PENDING").length,
      rejected: this.entries.filter((e) => e.state === "REJECTED").length,
    };
  }

  private mutate(clientUuid: string, fn: (e: OutboxEntry) => void): void {
    const e = this.entries.find((x) => x.clientUuid === clientUuid);
    if (e) fn(e);
  }
}
