import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

/** Durable local store (NFR-014): WAL mode, created on first open.
 *  `outbox` is the ordered sync queue; inspections/results are the local
 *  working copies; photos_pending upload after their owner record syncs. */
const DDL = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS outbox (
  client_uuid TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'PENDING',
  last_error TEXT,
  last_attempt_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_state_created ON outbox(state, created_at);
CREATE TABLE IF NOT EXISTS local_inspections (
  client_uuid TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  appointment_id TEXT,
  checklist_version_id TEXT NOT NULL,
  checklist_json TEXT NOT NULL,
  odometer_km INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  started_at INTEGER NOT NULL,
  submitted_at INTEGER
);
CREATE TABLE IF NOT EXISTS local_results (
  inspection_client_uuid TEXT NOT NULL,
  point_code TEXT NOT NULL,
  status TEXT,
  measured_value REAL,
  notes TEXT,
  photo_uris TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (inspection_client_uuid, point_code)
);
CREATE TABLE IF NOT EXISTS photos_pending (
  id TEXT PRIMARY KEY,
  owner_client_uuid TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  remote_path TEXT,
  state TEXT NOT NULL DEFAULT 'PENDING',
  point_code TEXT,
  observation_client_uuid TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_photos_owner ON photos_pending(owner_client_uuid, state);
CREATE TABLE IF NOT EXISTS local_observations (
  inspection_client_uuid TEXT NOT NULL,
  client_uuid TEXT NOT NULL,
  notes TEXT NOT NULL,
  photo_uris TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (inspection_client_uuid, client_uuid)
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();
let context: string | null = null;

/** Separate files prevent drafts, cache, photos and outbox crossing staff or backend boundaries.
 * Existing unscoped work is deliberately not adopted by the next login. */
export function setStorageContext(api: string, staffId: string): void {
  context = `${api}::${staffId}`;
}
export function clearStorageContext(): void { context = null; }
export function hasStorageContext(): boolean { return context !== null; }
export async function storageFileName(value: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  // Expo web VFS mxPathname is 64, including directory and journal suffixes.
  // 160 bits retains ample collision resistance while leaving room for -journal.
  return `field-${digest.slice(0, 40)}.db`;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  const key = context ?? "signed-out";
  if (!databases.has(key)) {
    databases.set(key, (async () => {
      const db = await SQLite.openDatabaseAsync(await storageFileName(key));
      await db.execAsync(DDL);
      const photoColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(photos_pending)");
      const existing = new Set(photoColumns.map((column) => column.name));
      for (const column of ["point_code", "observation_client_uuid", "last_error"]) {
        if (!existing.has(column)) await db.execAsync(`ALTER TABLE photos_pending ADD COLUMN ${column} TEXT`);
      }
      return db;
    })().catch((error) => { databases.delete(key); throw error; }));
  }
  return databases.get(key)!;
}
