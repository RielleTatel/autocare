import * as Location from "expo-location";

export type LocationResult =
  | { ok: true; lat: number; lng: number; address: string | null }
  | { ok: false; reason: "DENIED" | "UNAVAILABLE" };

// Read at call time, not at module load: Expo inlines EXPO_PUBLIC_* at build,
// but a module-level capture also freezes the value for every test that has
// not set it yet, which silently turns geocoding into a no-op.
const mapboxToken = (): string | undefined => process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/**
 * The single vendor swap point for SI-7 (see plan D-2 and "The honest limits
 * of D-2"). If Mapbox's Zamboanga City coverage proves too thin, only this
 * function changes — the map tiles are a separate decision.
 */
export async function resolveAddress(lat: number, lng: number): Promise<string | null> {
  const token = mapboxToken();
  if (!token) return null;
  try {
    // Mapbox orders coordinates lng,lat. Getting this backwards puts the
    // member in the wrong hemisphere without any error to notice.
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${token}&limit=1&language=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: Array<{ place_name?: string }> };
    return body.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

/**
 * FR-032 — where the member is.
 *
 * Every geocoding failure degrades to a null address rather than a thrown
 * error, because the coordinates alone are enough to dispatch on and the
 * landmark note covers the rest. Under D-3 the member can also drag the pin,
 * so a wrong-but-present address is recoverable too.
 */
export async function captureLocation(): Promise<LocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return { ok: false, reason: "DENIED" };

  let coords: { latitude: number; longitude: number };
  try {
    // Balanced, not Highest: a roadside fix needs to be fast and street-level,
    // and Highest can spin for many seconds hunting metres of precision.
    ({ coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  } catch {
    return { ok: false, reason: "UNAVAILABLE" };
  }

  const address = await resolveAddress(coords.latitude, coords.longitude);
  return { ok: true, lat: coords.latitude, lng: coords.longitude, address };
}
