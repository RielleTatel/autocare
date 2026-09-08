/** Offline outbox + sync contracts (Phase 4, F-03). The repos are thin
 *  interfaces so the processor and screens are testable in jest with the
 *  in-memory implementations; expo-sqlite implementations are wired on device. */

export type OutboxState = "PENDING" | "SYNCED" | "REJECTED";
export type SyncEntityType = "inspection" | "waste_record" | "trip_status" | "trip_condition" | "payment_cash";
export type SyncOp = "create" | "submit";

export interface OutboxEntry {
  clientUuid: string;
  entityType: SyncEntityType;
  op: SyncOp;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  state: OutboxState;
  lastError?: string;
  lastAttemptAt?: number;
}

/** True for the entry itself, or for one whose payload names it as its parent
 *  inspection. The create→submit link is payload-level only (the outbox schema
 *  records no relationship), so this predicate is where that knowledge lives. */
export const dependsOn = (e: OutboxEntry, clientUuid: string): boolean =>
  e.clientUuid === clientUuid ||
  (e.payload as { inspectionClientUuid?: string }).inspectionClientUuid === clientUuid;

export interface OutboxRepo {
  enqueue(e: { clientUuid: string; entityType: SyncEntityType; op: SyncOp; payload: Record<string, unknown> }): Promise<void>;
  /** PENDING entries in strict createdAt (enqueue) order. */
  pendingInOrder(): Promise<OutboxEntry[]>;
  markSynced(clientUuid: string): Promise<void>;
  /** Park a server-rejected entry; it no longer blocks later items (F-03 surfaces it). */
  markRejected(clientUuid: string, error: string): Promise<void>;
  /** Record a failed delivery attempt (network) for backoff. */
  recordAttempt(clientUuid: string, at: number, error: string): Promise<void>;
  rejectedInOrder(): Promise<OutboxEntry[]>;
  /** Permanently drop an entry and anything that depends on it. A server
   *  rejection is terminal on the client (nothing moves REJECTED back to
   *  PENDING), so without this a rejected item is unclearable short of wiping
   *  app data.
   *
   *  Cascades because an inspection `submit` references its `create` only by
   *  `payload.inspectionClientUuid`: once the create is gone the submit can
   *  never apply, and leaving it behind strands a second card the technician
   *  has to reason about. Returns every clientUuid removed so the caller can
   *  clean up the matching local rows. */
  discard(clientUuid: string): Promise<string[]>;
  counts(): Promise<{ pending: number; rejected: number }>;
}

export type SyncItemStatus = "APPLIED" | "DUPLICATE" | "REJECTED";
export interface SyncBatchResult {
  clientUuid: string;
  status: SyncItemStatus;
  error?: { code: string; message: string };
}
export interface SyncTransport {
  syncBatch(items: Array<{ clientUuid: string; entityType: SyncEntityType; op: SyncOp; payload: Record<string, unknown> }>): Promise<SyncBatchResult[]>;
}

export type PhotoState = "PENDING" | "UPLOADED" | "FAILED";
export interface PendingPhoto {
  id: string;
  ownerClientUuid: string;
  localUri: string;
  remotePath: string | null;
  state: PhotoState;
}
export interface PhotoUploader {
  /** Upload every pending photo belonging to a synced record. JSON before photos (NFR-007). */
  uploadFor(ownerClientUuid: string): Promise<{ uploaded: number; failed: number }>;
  pendingCount(): Promise<number>;
}

export interface DrainReport {
  alreadyDraining: boolean;
  sent: number;
  applied: number;
  duplicates: number;
  rejected: number;
  /** Entries skipped this drain because their backoff window hasn't elapsed. */
  deferred: number;
  /** Entries whose delivery failed at the network level (will retry). */
  failed: number;
  photosUploaded: number;
}

export interface SyncStatusSnapshot {
  pendingCount: number;
  rejectedCount: number;
  lastSyncAt: number | null;
  isDraining: boolean;
  /** Message from the most recent failed delivery, cleared once a drain gets
   *  through. Drain callers fire-and-forget, so this is the only way a network
   *  or auth failure reaches the technician instead of dying in a .catch(). */
  lastError: string | null;
}
