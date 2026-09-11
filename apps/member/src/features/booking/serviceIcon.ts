import type { IconName } from "../../components/Icon";

/**
 * Glyph for a service type.
 *
 * Service types are admin-created rows (`POST /scheduling/service-types`), not a
 * fixed enum, so a lookup table alone would render every service a shop adds
 * after launch as the same fallback wrench. The seeded codes are mapped exactly;
 * anything else is matched on the words in its code and name, which is how a new
 * "BATTERY_REPLACEMENT" or "Wheel alignment" still arrives with a sensible icon.
 */
const BY_CODE: Record<string, IconName> = {
  OIL_CHANGE: "droplet",
  TIRE_ROTATION: "rotate-cw",
  BRAKE_SERVICE: "disc",
  AC_SERVICE: "snowflake",
  FULL_INSPECTION: "clipboard-check",
};

/** Ordered: the first keyword found wins, so "brake fluid" reads as brakes
 *  rather than as a fluid change. */
const BY_KEYWORD: [RegExp, IconName][] = [
  [/brake|pad|rotor/, "disc"],
  [/tyre|tire|wheel|align|rotat/, "rotate-cw"],
  [/a\/?c\b|aircon|air.?con|climate|cool/, "snowflake"],
  [/inspect|check|diagnos/, "clipboard-check"],
  [/oil|fluid|lube|coolant/, "droplet"],
  [/batter|charg/, "battery"],
  [/electric|wiring|alternator|starter/, "zap"],
  [/filter|air|vent|exhaust/, "wind"],
  [/tune|engine|transmission|belt/, "cog"],
  [/detail|wash|clean|polish/, "sparkles"],
  [/odomet|mileage|calibrat/, "gauge"],
];

/** Falls back to the wrench — honest for a service we have no vocabulary for. */
export function serviceIcon(code: string, name?: string): IconName {
  const exact = BY_CODE[code.toUpperCase()];
  if (exact) return exact;

  const haystack = `${code} ${name ?? ""}`.toLowerCase();
  for (const [pattern, icon] of BY_KEYWORD) {
    if (pattern.test(haystack)) return icon;
  }
  return "wrench";
}

/**
 * Tint for a service's icon tile — `fg` on a `bg` wash.
 *
 * Keyed on the glyph, not the service, so two services that share an icon
 * share a colour and the pairing can never drift. These are decorative
 * wayfinding tints on a small tile, deliberately drawn from outside the VHS
 * band scale: a service is not a condition, and principle 1 reserves the band
 * colours for scores and inspection status. They are muted a step below the
 * band fills so a tile can never be mistaken for a severity signal.
 */
export type ServiceTint = { bg: string; fg: string };

/**
 * Every tint is a cool hue — blue, teal, indigo, violet, graphite.
 *
 * That is the constraint, not a taste: the VHS band scale runs green → olive →
 * amber → orange → red, and principle 1 reserves those for scores and
 * inspection status. A green inspection tile or an amber battery tile would put
 * band-looking colour on a service, which is exactly the confusion the rule
 * exists to prevent. Staying cool keeps service colour and score colour in
 * separate families. Each pair clears 4.3:1 (WCAG wants 3:1 for a glyph) and is
 * a wide distance from every band fill and from the brand red.
 *
 * Fewer tints than glyphs, deliberately: the icon already distinguishes the
 * service, so colour is reinforcement and two glyphs may share a family.
 */
const BLUE: ServiceTint = { bg: "#E8F0F7", fg: "#2B6CA3" };
const TEAL: ServiceTint = { bg: "#E4F1F5", fg: "#26788C" };
const INDIGO: ServiceTint = { bg: "#EDEBF7", fg: "#5B4BA8" };
const VIOLET: ServiceTint = { bg: "#F1ECF5", fg: "#6E4A93" };
const GRAPHITE: ServiceTint = { bg: "#ECEFF1", fg: "#4A5B66" };
const SLATE: ServiceTint = { bg: "#ECEFF3", fg: "#4F6280" };

/** The neutral tile, for the wrench fallback and anything unmapped. */
const NEUTRAL: ServiceTint = { bg: "#EEF1F3", fg: "#51616F" };

/** Keyed on the glyph, not the service, so two services that share an icon
 *  share a colour and the pairing can never drift. */
const TINTS: Record<string, ServiceTint> = {
  droplet: BLUE,              // oil, fluids
  gauge: BLUE,                // odometer, calibration
  snowflake: TEAL,            // a/c
  wind: TEAL,                 // filters, air, exhaust
  "rotate-cw": INDIGO,        // tyres, wheels, alignment
  battery: INDIGO,            // battery, charging
  "clipboard-check": VIOLET,  // inspection, diagnostics
  sparkles: VIOLET,           // detailing
  zap: SLATE,                 // electrical
  disc: GRAPHITE,             // brakes
  cog: GRAPHITE,              // engine, drivetrain
};

export function serviceTint(icon: IconName): ServiceTint {
  return TINTS[icon] ?? NEUTRAL;
}
