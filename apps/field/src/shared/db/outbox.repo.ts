import { dependsOn, type OutboxEntry, type OutboxRepo, type OutboxState, type SyncEntityType, type SyncOp } from "../sync/types";
import { getDb } from "./schema";

type Row = {
  client_uuid: string; entity_type: string; op: string; payload: string;
  created_at: number; attempts: number; state: string; last_error: string | null; last_attempt_at: number | null;
};

const toEntry = (r: Row): OutboxEntry => ({
  clientUuid: r.client_uuid,
  entityType: r.entity_type as SyncEntityType,
  op: r.op as SyncOp,
  payload: JSON.parse(r.payload),
  createdAt: r.created_at,
  attempts: r.attempts,
  state: r.state as OutboxState,
  lastError: r.last_error ?? undefined,
  lastAttemptAt: r.last_attempt_at ?? undefined,
});

/** expo-sqlite-backed OutboxRepo. Behaviour is pinned by the MemoryOutboxRepo
 *  test suite; this class is a thin SQL translation of the same semantics. */
export class SqliteOutboxRepo implements OutboxRepo {
  async enqueue(e: { clientUuid: string; entityType: SyncEntityType; op: SyncOp; payload: Record<string, unknown> }): Promise<void> {
    const db = await getDb();
    // strictly monotonic created_at even within one ms: take max(created_at)+1 when the clock ties
    await db.runAsync(
      `INSERT INTO outbox (client_uuid, entity_type, op, payload, created_at)
       VALUES (?, ?, ?, ?, MAX(COALESCE((SELECT MAX(created_at) FROM outbox), 0) + 1, ?))`,
      e.clientUuid, e.entityType, e.op, JSON.stringify(e.payload), Date.now(),
    );
  }

  async pendingInOrder(): Promise<OutboxEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>("SELECT * FROM outbox WHERE state = 'PENDING' ORDER BY created_at ASC");
    return rows.map(toEntry);
  }

  async markSynced(clientUuid: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE outbox SET state = 'SYNCED', last_error = NULL WHERE client_uuid = ?", clientUuid);
  }

  async markRejected(clientUuid: string, error: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE outbox SET state = 'REJECTED', last_error = ? WHERE client_uuid = ?", error, clientUuid);
  }

  async recordAttempt(clientUuid: string, at: number, error: string): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE outbox SET attempts = attempts + 1, last_attempt_at = ?, last_error = ? WHERE client_uuid = ?", at, error, clientUuid);
  }

  async rejectedInOrder(): Promise<OutboxEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>("SELECT * FROM outbox WHERE state = 'REJECTED' ORDER BY created_at ASC");
    return rows.map(toEntry);
  }

  async discard(clientUuid: string): Promise<string[]> {
    const db = await getDb();
    // Resolve the group in JS using the same predicate as MemoryOutboxRepo (the
    // documented behavioural reference) rather than a json_extract() query, so
    // the two implementations cannot drift. The queue is small by design.
    const rows = await db.getAllAsync<Row>("SELECT * FROM outbox");
    const doomed = rows.map(toEntry).filter((e) => dependsOn(e, clientUuid));
    for (const e of doomed) {
      await db.runAsync("DELETE FROM outbox WHERE client_uuid = ?", e.clientUuid);
    }
    return doomed.map((e) => e.clientUuid);
  }

  async counts(): Promise<{ pending: number; rejected: number }> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ state: string; n: number }>(
      "SELECT state, COUNT(*) AS n FROM outbox WHERE state IN ('PENDING','REJECTED') GROUP BY state",
    );
    return {
      pending: rows.find((r) => r.state === "PENDING")?.n ?? 0,
      rejected: rows.find((r) => r.state === "REJECTED")?.n ?? 0,
    };
  }
}
