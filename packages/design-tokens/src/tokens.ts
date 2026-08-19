/** AutoCare+ "workshop precision" token set. Values are the source of truth
 *  for RN StyleSheets, the Tailwind preset, and public-page CSS vars. */

export const colors = {
  ink: "#16232E",        // primary text — deep steel blue-black
  inkMuted: "#51616F",   // secondary text
  chassis: "#EEF1F3",    // app background — cool workshop grey (never cream)
  surface: "#FFFFFF",    // cards, sheets
  line: "#D5DBE0",       // hairline borders
  primary: "#0E5AA7",    // Gauge Blue — actions, links, focus
  primaryDeep: "#0A2E4F",// headers, field-app chrome, certificate footer
  onPrimary: "#FFFFFF",
  danger: "#C2372C",     // destructive actions (distinct from CRITICAL band use)
  success: "#177245",    // confirmations
} as const;

/** Score bands per VHS Algorithm §11.5. `fill` is the chip/arc color,
 *  `on` the text color placed on it, `text` the color used on light surfaces. */
export const vhsBands = {
  EXCELLENT:       { min: 90, fill: "#177245", on: "#FFFFFF", text: "#0F5C37", labelEn: "Excellent", labelFil: "Napakaayos" },
  GOOD:            { min: 75, fill: "#5C9E31", on: "#FFFFFF", text: "#3F7420", labelEn: "Good", labelFil: "Maayos" },
  FAIR:            { min: 60, fill: "#B87E00", on: "#FFFFFF", text: "#8A5F00", labelEn: "Fair", labelFil: "Katamtaman" },
  NEEDS_ATTENTION: { min: 40, fill: "#C75E1B", on: "#FFFFFF", text: "#9C4204", labelEn: "Needs Attention", labelFil: "Kailangan ng Aksyon" },
  CRITICAL:        { min: 0,  fill: "#B3261E", on: "#FFFFFF", text: "#8F1D17", labelEn: "Critical", labelFil: "Delikado" },
} as const;

export const fontStacks = {
  display: `"Barlow Semi Condensed", "SF Pro Display", system-ui, sans-serif`, // score numerals, headings
  body: `"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif`,
  mono: `"IBM Plex Mono", ui-monospace, Menlo, monospace`, // plates, VINs, receipt & verification codes
} as const;

/** rem-based scale; RN multiplies by 16. Field app uses one step larger per role. */
export const typeScale = {
  score: { size: 4.5, weight: 600, family: "display" },   // the 0–100 numeral
  h1: { size: 1.75, weight: 600, family: "display" },
  h2: { size: 1.375, weight: 600, family: "display" },
  body: { size: 1, weight: 400, family: "body" },
  label: { size: 0.8125, weight: 500, family: "body" },
  code: { size: 0.9375, weight: 500, family: "mono" },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radii = { sm: 6, md: 12, pill: 999 } as const;
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
