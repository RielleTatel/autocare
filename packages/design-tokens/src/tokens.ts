/** AutoCare+ "workshop precision" token set. Values are the source of truth
 *  for RN StyleSheets, the Tailwind preset, and public-page CSS vars. */

export const colors = {
  ink: "#16232E",        // primary text — deep steel blue-black
  inkMuted: "#51616F",   // secondary text
  inkFaint: "#8A97A2",   // tertiary text, placeholders
  chassis: "#EEF1F3",    // app background — cool workshop grey (never cream)
  surface: "#FFFFFF",    // cards, sheets
  surfaceSoft: "#F7F8FA",   // inset fields, icon tiles
  surfaceSunken: "#E7EBEE", // recessed wells inside a card
  line: "#D5DBE0",       // hairline borders
  lineSoft: "#E7EBEE",   // soft-elevation card border (paired with shadow, not hairline)
  primary: "#D9273F",    // Ignition Red — actions, links, focus
  primaryDeep: "#6B0F22",// headers, field-app chrome, certificate footer, primary buttons
  primarySoft: "#FBE9EC",// tinted icon tiles, selected-row wash
  onPrimary: "#FFFFFF",
  ember: "#EE8034",      // logo gear's lower arc — brand-surface gradients only, never a UI accent
  danger: "#C2372C",     // destructive actions (distinct from CRITICAL band use)
  success: "#177245",    // confirmations
} as const;

/** Score bands per VHS Algorithm §11.5. `fill` is the chip/arc color,
 *  `on` the text color placed on it, `text` the color used on light surfaces,
 *  `soft` a light tint for large status surfaces. */
export const vhsBands = {
  EXCELLENT:       { min: 90, fill: "#177245", on: "#FFFFFF", text: "#0F5C37", soft: "#DCEFE4", labelEn: "Excellent", labelFil: "Napakaayos" },
  GOOD:            { min: 75, fill: "#5C9E31", on: "#FFFFFF", text: "#3F7420", soft: "#E6F2DC", labelEn: "Good", labelFil: "Maayos" },
  FAIR:            { min: 60, fill: "#B87E00", on: "#FFFFFF", text: "#8A5F00", soft: "#F7EDD5", labelEn: "Fair", labelFil: "Katamtaman" },
  NEEDS_ATTENTION: { min: 40, fill: "#C75E1B", on: "#FFFFFF", text: "#9C4204", soft: "#F9E7DB", labelEn: "Needs Attention", labelFil: "Kailangan ng Aksyon" },
  CRITICAL:        { min: 0,  fill: "#B3261E", on: "#FFFFFF", text: "#8F1D17", soft: "#F7E0DE", labelEn: "Critical", labelFil: "Delikado" },
} as const;

export const fontStacks = {
  display: `"Barlow Semi Condensed", "SF Pro Display", system-ui, sans-serif`, // score numerals, headings
  body: `"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif`,
  mono: `"IBM Plex Mono", ui-monospace, Menlo, monospace`, // plates, VINs, receipt & verification codes
} as const;

/** rem-based scale; RN multiplies by 16. Field app uses one step larger per role.
 *  `display` is the 2026 re-skin's editorial card headline (e.g. a vehicle name) —
 *  bigger than h1, still the display face. */
export const typeScale = {
  score: { size: 4.5, weight: 600, family: "display" },   // the 0–100 numeral
  display: { size: 2.5, weight: 600, family: "display" }, // editorial card headline
  h1: { size: 1.75, weight: 600, family: "display" },
  h2: { size: 1.375, weight: 600, family: "display" },
  body: { size: 1, weight: 400, family: "body" },
  label: { size: 0.8125, weight: 500, family: "body" },
  code: { size: 0.9375, weight: 500, family: "mono" },
} as const;

/** Letter-spacing in em, for roles where tracking is part of the brand voice —
 *  tight on display/score, open on labels, mono and plates. */
export const tracking = {
  display: -0.015, label: 0.03, plate: 0.12, code: 0.1,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Soft elevation — a tight contact shadow plus a wide, faint ambient one, over
 *  a soft border rather than the full-strength steel hairline. `flat` (hairline,
 *  no shadow) is kept for dense data surfaces: the staff console tables, the
 *  certificate. RN screens don't consume these box-shadow strings yet — native
 *  cards still read as hairline-on-chassis until the shadow is ported to
 *  RN's shadow* props. */
export const elevation = {
  flat: "none",
  card: "0 1px 2px rgba(22, 35, 46, 0.04), 0 8px 24px rgba(22, 35, 46, 0.05)",
  raised: "0 2px 4px rgba(22, 35, 46, 0.05), 0 16px 40px rgba(22, 35, 46, 0.08)",
  nav: "0 -2px 12px rgba(22, 35, 46, 0.06)",
  sheet: "0 -8px 40px rgba(22, 35, 46, 0.16)",
  scrim: "rgba(22, 35, 46, 0.4)",
} as const;

/** Motion communicates state change, hierarchy and navigation — nothing else. */
export const motion = {
  durInstant: "90ms", durFast: "140ms", durBase: "220ms", durSheet: "280ms",
  easeStandard: "cubic-bezier(0.2, 0, 0.2, 1)", easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  pressOpacity: 0.82,
} as const;

/** Stroke widths (px). hairline card border, 1.5 control outline, 4/5 status edges. */
export const borders = { hairline: 1, control: 1.5, accent: 4, accentRow: 5, gaugeStroke: 18 } as const;
/** 2026 re-skin shape language — chips 8, controls 12, default card 20, major
 *  card/sheet 28, hero surface 36. `sm`/`md` carry the new control/card values
 *  so existing call sites pick up the rounder shape without a rename; `xs`/`lg`/`xl`
 *  are additions for new work. Pre-2026 values are kept as `radiiLegacy`. */
export const radii = { xs: 8, sm: 12, md: 20, lg: 28, xl: 36, pill: 999 } as const;
export const radiiLegacy = { sm: 6, md: 12 } as const;
export const targets = { memberMinDp: 48, fieldMinDp: 56 } as const;

export function bandForScore(score: number) {
  for (const [key, b] of Object.entries(vhsBands)) if (score >= b.min) return key as keyof typeof vhsBands;
  return "CRITICAL";
}

/** WCAG 2.x relative-luminance contrast ratio. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const chan = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
  };
  const [a, b] = [lum(hexA), lum(hexB)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
