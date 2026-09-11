type Point = { lat: number; lng: number };

/**
 * FR-039 — driving distance from the workshop to the incident.
 *
 * Best-effort by design: every failure returns null, because a maps API being
 * unreachable must never block an advisor from closing out a resolved call.
 * The column is nullable for the same reason.
 */
export async function routeDistanceKm(from: Point, to: Point): Promise<number | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  try {
    // lng,lat ordering again — see the member app's location module.
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?access_token=${token}&overview=false&alternatives=false`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { routes?: Array<{ distance?: number }> };
    const metres = body.routes?.[0]?.distance;
    return typeof metres === "number" ? metres / 1000 : null;
  } catch {
    return null;
  }
}

/**
 * The workshop end of that route. Env-configured rather than hard-coded: the
 * origin moves if the shop moves, and a literal here would be found the hard
 * way. Returns null when unset, which makes the distance null too.
 */
export function workshopOrigin(): Point | null {
  const lat = Number(process.env.WORKSHOP_LAT);
  const lng = Number(process.env.WORKSHOP_LNG);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
