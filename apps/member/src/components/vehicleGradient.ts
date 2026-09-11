export type VehicleGradient = { from: string; to: string };

/**
 * The field a vehicle card is painted on: a tonal gradient, lighter into deeper
 * within one hue family.
 *
 * Both stops of a pair belong to the same hue rather than converging on a
 * shared dark corner — a common end stop tinted every card the same way at the
 * bottom and flattened the difference between them, which is the whole point of
 * giving each vehicle a colour.
 *
 * Every stop is light enough to read as a colour and dark enough to carry the
 * card's white text: white clears 9:1, the subtitle 7:1, the on-dark accent
 * 4:1, and each stop stays at least 1.4:1 in tone from all five VHS band fills
 * so a card field can never be mistaken for a score. Greens and ambers are
 * absent on purpose — those are the band scale's own hues (principle 1), and a
 * forest-green card would quietly suggest "Excellent".
 *
 * `wine` is the brand family and leads the list, so a single-vehicle member
 * sees the brand colour rather than an arbitrary one.
 */
export const VEHICLE_FIELDS: readonly VehicleGradient[] = [
  { from: "#8A132C", to: "#6B0F22" }, // wine — brand primary-deep
  { from: "#1C4978", to: "#173C63" }, // navy
  { from: "#5C3477", to: "#3E2350" }, // plum
  { from: "#3D4956", to: "#2F3945" }, // graphite
  { from: "#39408A", to: "#2A2F66" }, // indigo
  { from: "#2F485D", to: "#25384A" }, // slate
] as const;

/**
 * Stable per-vehicle colour, so a card keeps its identity across launches,
 * re-sorts and refetches — a hash of the id, never the list index, which would
 * reshuffle every card the moment a vehicle is added or archived.
 *
 * FNV-1a: tiny, deterministic, and well spread over short ASCII keys like a
 * UUID. Nothing here is security-sensitive; it only has to be stable.
 */
export function vehicleGradient(vehicleId: string): VehicleGradient {
  let hash = 0x811c9dc5;
  for (let i = 0; i < vehicleId.length; i++) {
    hash ^= vehicleId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return VEHICLE_FIELDS[hash % VEHICLE_FIELDS.length];
}
