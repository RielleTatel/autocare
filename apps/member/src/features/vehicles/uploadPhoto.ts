import { api } from "../../shared/api";

export async function uploadVehiclePhoto(vehicleId: string, localUri: string, kind: "PHOTO" | "ORCR") {
  const contentType = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
    "/uploads/signed-url", { vehicleId, contentType, kind });
  const blob = await (await fetch(localUri)).blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error("Photo is over 5 MB — retake at lower quality");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!put.ok) throw new Error("Upload failed — try again");
  return publicUrl;
}
