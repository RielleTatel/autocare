import { getDb } from "./schema";

export type LocalResult = {
  pointCode: string;
  status?: string;
  measuredValue?: number;
  notes?: string;
  photoUris: string[];
};

export type LocalInspection = {
  clientUuid: string;
  vehicleId: string;
  appointmentId: string | null;
  checklistVersionId: string;
  /** Snapshot of the cached checklist at draft start — versions are immutable,
   *  so the capture flow never shifts under the mechanic mid-inspection. */
  checklistJson: string;
  odometerKm: number | null;
  notes: string | null;
  status: "DRAFT" | "LOCKED";
  startedAt: number;
  submittedAt: number | null;
};

export class InspectionsRepo {
  async createDraft(d: Omit<LocalInspection, "status" | "submittedAt">): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO local_inspections (client_uuid, vehicle_id, appointment_id, checklist_version_id, checklist_json, odometer_km, notes, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      d.clientUuid, d.vehicleId, d.appointmentId, d.checklistVersionId, d.checklistJson, d.odometerKm, d.notes, d.startedAt,
    );
  }

  async get(clientUuid: string): Promise<LocalInspection | null> {
    const db = await getDb();
    const r = await db.getFirstAsync<any>("SELECT * FROM local_inspections WHERE client_uuid = ?", clientUuid);
    if (!r) return null;
    return {
      clientUuid: r.client_uuid, vehicleId: r.vehicle_id, appointmentId: r.appointment_id,
      checklistVersionId: r.checklist_version_id, checklistJson: r.checklist_json,
      odometerKm: r.odometer_km, notes: r.notes, status: r.status, startedAt: r.started_at, submittedAt: r.submitted_at,
    };
  }

  async listDrafts(): Promise<LocalInspection[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM local_inspections ORDER BY started_at DESC");
    return rows.map((r) => ({
      clientUuid: r.client_uuid, vehicleId: r.vehicle_id, appointmentId: r.appointment_id,
      checklistVersionId: r.checklist_version_id, checklistJson: r.checklist_json,
      odometerKm: r.odometer_km, notes: r.notes, status: r.status, startedAt: r.started_at, submittedAt: r.submitted_at,
    }));
  }

  async saveResult(inspectionClientUuid: string, r: LocalResult): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO local_results (inspection_client_uuid, point_code, status, measured_value, notes, photo_uris)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (inspection_client_uuid, point_code)
       DO UPDATE SET status = excluded.status, measured_value = excluded.measured_value, notes = excluded.notes, photo_uris = excluded.photo_uris`,
      inspectionClientUuid, r.pointCode, r.status ?? null, r.measuredValue ?? null, r.notes ?? null, JSON.stringify(r.photoUris),
    );
  }

  async results(inspectionClientUuid: string): Promise<LocalResult[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<any>("SELECT * FROM local_results WHERE inspection_client_uuid = ?", inspectionClientUuid);
    return rows.map((r) => ({
      pointCode: r.point_code,
      status: r.status ?? undefined,
      measuredValue: r.measured_value ?? undefined,
      notes: r.notes ?? undefined,
      photoUris: JSON.parse(r.photo_uris),
    }));
  }

  /** Submission locks the draft read-only (append-only server side; client mirrors it). */
  async lock(clientUuid: string, submittedAt: number): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE local_inspections SET status = 'LOCKED', submitted_at = ? WHERE client_uuid = ?", submittedAt, clientUuid);
  }

  async storageUsedBytes(): Promise<number> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ n: number }>(
      "SELECT (SELECT COALESCE(SUM(LENGTH(payload)),0) FROM outbox) + (SELECT COALESCE(SUM(LENGTH(checklist_json)),0) FROM local_inspections) AS n",
    );
    return r?.n ?? 0;
  }
}
