import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { getDb } from "../db/schema";
import { api } from "../api";
import type { PendingPhoto, PhotoUploader } from "./types";

const MAX_BYTES = 500 * 1024; // NFR-006
const MAX_EDGE = 1600;

/** Resize to ≤1600px longest edge, then step JPEG quality down until ≤500 KB. */
export async function compressForUpload(uri: string): Promise<string> {
  let quality = 0.8;
  let out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
    compress: quality, format: ImageManipulator.SaveFormat.JPEG,
  });
  for (;;) {
    const info = await FileSystem.getInfoAsync(out.uri);
    const size = info.exists && "size" in info ? ((info as { size?: number }).size ?? 0) : 0;
    if (size <= MAX_BYTES || quality <= 0.2) return out.uri;
    quality -= 0.15;
    out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
      compress: quality, format: ImageManipulator.SaveFormat.JPEG,
    });
  }
}

export async function queuePhoto(id: string, ownerClientUuid: string, localUri: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO photos_pending (id, owner_client_uuid, local_uri, state) VALUES (?, ?, ?, 'PENDING')",
    id, ownerClientUuid, localUri,
  );
}

/** Uploads a record's photos only after that record's JSON has synced (NFR-007). */
export class SqlitePhotoUploader implements PhotoUploader {
  async uploadFor(ownerClientUuid: string): Promise<{ uploaded: number; failed: number }> {
    const db = await getDb();
    const rows = await db.getAllAsync<PendingPhoto & { local_uri: string; owner_client_uuid: string }>(
      "SELECT id, owner_client_uuid, local_uri, remote_path, state FROM photos_pending WHERE owner_client_uuid = ? AND state = 'PENDING'",
      ownerClientUuid,
    );
    let uploaded = 0, failed = 0;
    for (const row of rows) {
      try {
        const signed = await api.post<{ uploadUrl: string; objectPath: string }>("/uploads/signed-url", {
          kind: "inspection-photo", ownerId: ownerClientUuid, contentType: "image/jpeg",
        });
        await FileSystem.uploadAsync(signed.uploadUrl, row.local_uri, {
          httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" },
        });
        await db.runAsync("UPDATE photos_pending SET state = 'UPLOADED', remote_path = ? WHERE id = ?", signed.objectPath, row.id);
        uploaded += 1;
      } catch {
        await db.runAsync("UPDATE photos_pending SET state = 'FAILED' WHERE id = ?", row.id);
        failed += 1;
      }
    }
    return { uploaded, failed };
  }

  async pendingCount(): Promise<number> {
    const db = await getDb();
    const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM photos_pending WHERE state = 'PENDING'");
    return r?.n ?? 0;
  }
}

/** Drop queued photos belonging to a discarded record. Their owner record will
 *  never sync, so uploading them would orphan bytes in the bucket. */
export async function deletePhotosFor(ownerClientUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM photos_pending WHERE owner_client_uuid = ?", ownerClientUuid);
}
