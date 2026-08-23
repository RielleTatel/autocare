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
}
