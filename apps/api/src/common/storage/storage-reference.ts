/**
 * Convert canonical paths and Supabase public/private/signed object URLs back
 * to the stable path stored in Postgres. Signed URLs are display credentials,
 * so persisting them would make photos disappear when their token expires.
 */
export function storagePathFromReference(reference: string, bucket: string): string | null {
  if (!reference.includes(":")) {
    const path = reference.replace(/^\/+/, "");
    return path && !path.split("/").includes("..") ? path : null;
  }

  try {
    const pathname = decodeURIComponent(new URL(reference).pathname);
    const markers = [
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    return marker ? pathname.slice(pathname.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
}
