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
  state TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS idx_photos_owner ON photos_pending(owner_client_uuid, state);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("autocare-field.db");
      await db.execAsync(DDL);
      return db;
    })();
  }
  return dbPromise;
}
