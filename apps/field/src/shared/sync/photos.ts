import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { getDb } from "../db/schema";
import { api } from "../api";
import type { PhotoUploader } from "./types";

const MAX_BYTES = 500 * 1024; // NFR-006
const MAX_EDGE = 1600;

/** Resize to ≤1600px longest edge, then step JPEG quality down until ≤500 KB. */
export async function compressForUpload(uri: string): Promise<string> {
  let quality = 0.8;
  const original = await ImageManipulator.manipulateAsync(uri, [], { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
  const resize = original.width >= original.height ? { width: Math.min(original.width, MAX_EDGE) } : { height: Math.min(original.height, MAX_EDGE) };
  let out = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
    compress: quality, format: ImageManipulator.SaveFormat.JPEG,
  });
  for (;;) {
    const info = Platform.OS === "web" ? null : await FileSystem.getInfoAsync(out.uri);
    const size = Platform.OS === "web" ? (await (await fetch(out.uri)).blob()).size : info?.exists && "size" in info ? ((info as { size?: number }).size ?? 0) : 0;
    if (size > 0 && size <= MAX_BYTES) return out.uri;
    if (quality <= 0.2) throw new Error("This photo is too large to save. Retake it or continue without a photo.");
    quality = Math.max(0.2, quality - 0.15);
    out = await ImageManipulator.manipulateAsync(uri, [{ resize }], {
      compress: quality, format: ImageManipulator.SaveFormat.JPEG,
    });
  }
}

export type InspectionPhotoTarget = { type: "RESULT"; pointCode: string } | { type: "OBSERVATION"; observationClientUuid: string };

/** Camera/manipulator URIs may be temporary. Retain bytes in the app's durable
 * documents on native, or a data URI in SQLite on web, before claiming saved. */
async function retainPhoto(id: string, localUri: string): Promise<string> {
  if (Platform.OS === "web") {
    if (localUri.startsWith("data:")) return localUri;
    const response = await fetch(localUri);
    if (!response.ok) throw new Error("The captured photo could not be read.");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The photo could not be saved."));
      reader.onerror = () => reject(new Error("The photo could not be saved."));
      reader.readAsDataURL(blob);
    });
  }
  if (!FileSystem.documentDirectory) throw new Error("Photo storage is unavailable on this device.");
  const directory = `${FileSystem.documentDirectory}inspection-photos/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const retained = `${directory}${id}.jpg`;
  if ((await FileSystem.getInfoAsync(retained)).exists) return retained;
  await FileSystem.copyAsync({ from: localUri, to: retained });
  return retained;
}

export async function queuePhoto(id: string, ownerClientUuid: string, localUri: string, target: InspectionPhotoTarget): Promise<string> {
  const db = await getDb();
  const retained = await retainPhoto(id, localUri);
  await db.runAsync(
    "INSERT OR REPLACE INTO photos_pending (id, owner_client_uuid, local_uri, state, point_code, observation_client_uuid) VALUES (?, ?, ?, 'PENDING', ?, ?)",
    id, ownerClientUuid, retained, target.type === "RESULT" ? target.pointCode : null, target.type === "OBSERVATION" ? target.observationClientUuid : null,
  );
  return retained;
}

/** Uploads a record's photos only after that record's JSON has synced (NFR-007). */
export class SqlitePhotoUploader implements PhotoUploader {
  async uploadFor(ownerClientUuid: string): Promise<{ uploaded: number; failed: number }> {
    const db = await getDb();
    const receipts = await db.getAllAsync<{ payload: string }>("SELECT payload FROM outbox WHERE entity_type = 'inspection' AND op = 'submit' AND state = 'SYNCED'");
    if (!receipts.some((receipt) => {
      try { return JSON.parse(receipt.payload).inspectionClientUuid === ownerClientUuid; } catch { return false; }
    })) return { uploaded: 0, failed: 0 };
    const rows = await db.getAllAsync<{ id: string; local_uri: string; remote_path: string | null; point_code: string | null; observation_client_uuid: string | null }>(
      "SELECT id, local_uri, remote_path, point_code, observation_client_uuid FROM photos_pending WHERE owner_client_uuid = ? AND state = 'PENDING'",
      ownerClientUuid,
    );
    let uploaded = 0, failed = 0;
    for (const row of rows) {
      try {
        // Legacy rows can be recovered only when the saved result supplies one
        // unambiguous point association. Never attach to an arbitrary finding.
        if (!row.point_code && !row.observation_client_uuid) {
          const candidates = await db.getAllAsync<{ point_code: string; photo_uris: string }>("SELECT point_code, photo_uris FROM local_results WHERE inspection_client_uuid = ?", ownerClientUuid);
          const matching = candidates.filter((candidate) => (JSON.parse(candidate.photo_uris) as string[]).includes(row.local_uri));
          if (matching.length !== 1) throw new Error("This older photo has no confirmed finding association. Review it with an advisor.");
          row.point_code = matching[0].point_code;
          await db.runAsync("UPDATE photos_pending SET point_code = ? WHERE id = ?", row.point_code, row.id);
        }
        const target: InspectionPhotoTarget = row.point_code ? { type: "RESULT", pointCode: row.point_code } : { type: "OBSERVATION", observationClientUuid: row.observation_client_uuid! };
        const input = { inspectionClientUuid: ownerClientUuid, clientUuid: row.id, contentType: "image/jpeg" as const, target };
        let storagePath = row.remote_path;
        if (!storagePath) {
          const signed = await api.post<{ uploadUrl: string; storagePath: string }>("/uploads/inspection-signed-url", input);
          if (Platform.OS === "web") {
            const bytes = await (await fetch(row.local_uri)).blob();
            const response = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
            if (!response.ok) throw new Error("The photo upload failed. Retry when connected.");
          } else {
            const response = await FileSystem.uploadAsync(signed.uploadUrl, row.local_uri, { httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" } });
            if (response.status < 200 || response.status >= 300) throw new Error("The photo upload failed. Retry when connected.");
          }
          storagePath = signed.storagePath;
          await db.runAsync("UPDATE photos_pending SET remote_path = ? WHERE id = ?", storagePath, row.id);
        }
        await api.post(`/inspections/${encodeURIComponent(ownerClientUuid)}/photos`, { ...input, storagePath });
        await db.runAsync("UPDATE photos_pending SET state = 'UPLOADED', last_error = NULL WHERE id = ?", row.id);
        uploaded += 1;
      } catch (error) {
        await db.runAsync("UPDATE photos_pending SET state = 'FAILED', last_error = ? WHERE id = ?", error instanceof Error ? error.message : "Photo upload failed.", row.id);
        failed += 1;
      }
    }
    return { uploaded, failed };
  }

  async pendingCount(): Promise<number> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM photos_pending WHERE state IN ('PENDING', 'FAILED')");
    return r?.n ?? 0;
  }

  async uploadReady(): Promise<{ uploaded: number; failed: number }> {
    const db = await getDb();
    const owners = await db.getAllAsync<{ owner_client_uuid: string }>("SELECT DISTINCT owner_client_uuid FROM photos_pending WHERE state = 'PENDING'");
    const totals = { uploaded: 0, failed: 0 };
    for (const owner of owners) {
      const result = await this.uploadFor(owner.owner_client_uuid);
      totals.uploaded += result.uploaded; totals.failed += result.failed;
    }
    return totals;
  }

  async retryFailed(): Promise<void> {
    const db = await getDb();
    await db.runAsync("UPDATE photos_pending SET state = 'PENDING', last_error = NULL WHERE state = 'FAILED'");
  }

  async summary(ownerClientUuid?: string): Promise<{ pending: number; failed: number; lastError: string | null }> {
    const db = await getDb();
    const filter = ownerClientUuid ? " AND owner_client_uuid = ?" : "";
    const params = ownerClientUuid ? [ownerClientUuid] : [];
    const rows = await db.getAllAsync<{ state: string; count: number }>(`SELECT state, COUNT(*) AS count FROM photos_pending WHERE state IN ('PENDING','FAILED')${filter} GROUP BY state`, ...params);
    const error = await db.getFirstAsync<{ last_error: string }>(`SELECT last_error FROM photos_pending WHERE state = 'FAILED' AND last_error IS NOT NULL${filter} ORDER BY rowid DESC LIMIT 1`, ...params);
    return { pending: rows.find((row) => row.state === "PENDING")?.count ?? 0, failed: rows.find((row) => row.state === "FAILED")?.count ?? 0, lastError: error?.last_error ?? null };
  }
}

/** Drop queued photos belonging to a discarded record. Their owner record will
 *  never sync, so uploading them would orphan bytes in the bucket. */
export async function deletePhotosFor(ownerClientUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM photos_pending WHERE owner_client_uuid = ?", ownerClientUuid);
}
