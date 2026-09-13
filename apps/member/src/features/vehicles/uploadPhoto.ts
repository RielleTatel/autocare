import { api } from "../../shared/api";

export async function uploadVehiclePhoto(vehicleId: string, localUri: string, kind: "PHOTO" | "ORCR") {
  const contentType = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const { uploadUrl, storagePath } = await api.post<{ uploadUrl: string; storagePath: string }>(
    "/uploads/signed-url", { vehicleId, contentType, kind });
  const localFile = await fetch(localUri);
  const bytes = await localFile.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Photo is over 5 MB — retake at lower quality");

  // Supabase signed uploads accept a raw binary body when these headers match
  // StorageFileApi.uploadToSignedUrl. Sending a React Native Blob directly can
  // be encoded as an unsupported object and reach Storage as an empty upload.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "cache-control": "max-age=3600",
      "x-upsert": "false",
    },
    body: bytes,
  });
  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    throw new Error(detail ? `Upload failed (${put.status}): ${detail}` : `Upload failed (${put.status}) — try again`);
  }
  const { signedUrl } = await api.post<{ signedUrl: string }>("/uploads/signed-read-url", {
    vehicleId,
    storageReference: storagePath,
  });
  return signedUrl;
}
