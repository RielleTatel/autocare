import { colors, vhsBands, fontStacks, typeScale, tracking, spacing, radii, elevation, motion, borders, targets } from "./tokens";

/** Dark-theme neutral/brand overrides — verbatim from the design system's
 *  colors.css. Band fills never change across theme or print. */
const DARK = {
  ink: "#E9ECEF", inkMuted: "#A3AEB8", inkFaint: "#7C8792", chassis: "#101820", surface: "#1A242E",
  surfaceSoft: "#1F2A35", surfaceSunken: "#16202A", line: "#2C3947", lineSoft: "#232F3A",
  primary: "#F0576B", primarySoft: "#33161C", codeBg: "#232F3A",
} as const;

/** Renders every design token as a CSS custom-property stylesheet: a light
 *  `:root` block plus a `:root[data-theme="dark"]` override. Every value is
 *  derived from the token objects — the single source of truth. */
export function toCssVars(): string {
  const line = (k: string, v: string) => `  ${k}: ${v};`;
  const root: string[] = [
    line("--ac-ink", colors.ink), line("--ac-ink-muted", colors.inkMuted), line("--ac-ink-faint", colors.inkFaint),
    line("--ac-chassis", colors.chassis), line("--ac-surface", colors.surface),
    line("--ac-surface-soft", colors.surfaceSoft), line("--ac-surface-sunken", colors.surfaceSunken),
    line("--ac-line", colors.line), line("--ac-line-soft", colors.lineSoft),
    line("--ac-primary", colors.primary), line("--ac-primary-deep", colors.primaryDeep),
    line("--ac-primary-soft", colors.primarySoft), line("--ac-on-primary", colors.onPrimary),
    line("--ac-ember", colors.ember),
    line("--ac-danger", colors.danger), line("--ac-success", colors.success),
    line("--ac-code-bg", "#E4E9EC"),
    // masthead / deep-chrome support tints
    // Lightened with primary-deep: on the old #5A1220 the meta tint cleared
    // 4.5:1 at #B08E96, but against the wine #6B0F22 it fell to 4.17. #C9A9B0
    // restores the margin (5.7:1) on the surfaces these are made for.
    line("--ac-on-deep-body", "#E4C9CE"), line("--ac-on-deep-meta", "#C9A9B0"),
    // band fill + text + soft
    ...Object.entries(vhsBands).flatMap(([k, v]) => {
      const s = k.toLowerCase().replace("_", "-");
      return [line(`--ac-band-${s}`, v.fill), line(`--ac-band-${s}-text`, v.text), line(`--ac-band-${s}-soft`, v.soft)];
    }),
    line("--ac-band-on", "#FFFFFF"),
    // severity aliases
    line("--ac-sev-critical", "var(--ac-band-critical)"),
    line("--ac-sev-attention", "var(--ac-band-needs-attention)"),
    line("--ac-sev-monitor", "var(--ac-band-fair)"),
    line("--ac-sev-info", "var(--ac-primary)"),
    // semantic color aliases
    line("--text-primary", "var(--ac-ink)"), line("--text-muted", "var(--ac-ink-muted)"),
    line("--text-faint", "var(--ac-ink-faint)"),
    line("--text-on-primary", "var(--ac-on-primary)"), line("--text-link", "var(--ac-primary)"),
    line("--text-danger", "var(--ac-danger)"),
    line("--surface-app", "var(--ac-chassis)"), line("--surface-card", "var(--ac-surface)"),
    line("--surface-card-soft", "var(--ac-surface-soft)"), line("--surface-sunken", "var(--ac-surface-sunken)"),
    line("--surface-chrome", "var(--ac-primary-deep)"),
    line("--surface-code", "var(--ac-code-bg)"),
    line("--border-hairline", "var(--ac-line)"), line("--border-soft", "var(--ac-line-soft)"),
    line("--border-strong", "var(--ac-ink)"),
    line("--action-primary", "var(--ac-primary)"), line("--action-primary-hover", "#C21F36"),
    line("--action-primary-press", "#A81A2E"), line("--action-destructive", "var(--ac-danger)"),
    line("--action-disabled-bg", "var(--ac-line)"), line("--action-disabled-fg", "var(--ac-ink-muted)"),
    line("--focus-ring", "var(--ac-primary)"),
    // spacing
    ...Object.entries(spacing).map(([k, v]) => line(`--ac-space-${k}`, `${v}px`)),
    // radii — 2026 re-skin scale (xs 8 / sm 12 / md 20 / lg 28 / xl 36 / pill), plus legacy fallback
    line("--ac-radius-xs", `${radii.xs}px`), line("--ac-radius-sm", `${radii.sm}px`),
    line("--ac-radius-md", `${radii.md}px`), line("--ac-radius-lg", `${radii.lg}px`),
    line("--ac-radius-xl", `${radii.xl}px`), line("--ac-radius-pill", `${radii.pill}px`),
    line("--ac-radius-legacy-sm", "6px"), line("--ac-radius-legacy-md", "12px"),
    // targets + borders
    line("--ac-target-member", `${targets.memberMinDp}px`), line("--ac-target-field", `${targets.fieldMinDp}px`),
    line("--ac-hairline", `${borders.hairline}px`), line("--ac-border-control", `${borders.control}px`),
    line("--ac-border-accent", `${borders.accent}px`), line("--ac-border-accent-row", `${borders.accentRow}px`),
    line("--ac-gauge-stroke", `${borders.gaugeStroke}px`),
    // fonts + type
    line("--ac-font-display", fontStacks.display), line("--ac-font-body", fontStacks.body),
    line("--ac-font-mono", fontStacks.mono),
    ...Object.entries(typeScale).map(([k, v]) => line(`--ac-size-${k}`, `${v.size}rem`)),
    line("--ac-tracking-display", `${tracking.display}em`), line("--ac-tracking-label", `${tracking.label}em`),
    line("--ac-tracking-plate", `${tracking.plate}em`), line("--ac-tracking-code", `${tracking.code}em`),
    // elevation
    line("--ac-elevation-flat", elevation.flat), line("--ac-elevation-card", elevation.card),
    line("--ac-elevation-raised", elevation.raised), line("--ac-elevation-nav", elevation.nav),
    line("--ac-elevation-sheet", elevation.sheet),
    line("--ac-scrim", elevation.scrim),
    // motion
    line("--ac-duration-instant", motion.durInstant), line("--ac-duration-fast", motion.durFast),
    line("--ac-duration-base", motion.durBase), line("--ac-duration-sheet", motion.durSheet),
    line("--ac-ease-standard", motion.easeStandard), line("--ac-ease-out", motion.easeOut),
    line("--ac-press-opacity", String(motion.pressOpacity)),
  ];
  const dark: string[] = [
    line("--ac-ink", DARK.ink), line("--ac-ink-muted", DARK.inkMuted), line("--ac-ink-faint", DARK.inkFaint),
    line("--ac-chassis", DARK.chassis), line("--ac-surface", DARK.surface),
    line("--ac-surface-soft", DARK.surfaceSoft), line("--ac-surface-sunken", DARK.surfaceSunken),
    line("--ac-line", DARK.line), line("--ac-line-soft", DARK.lineSoft),
    line("--ac-primary", DARK.primary), line("--ac-primary-soft", DARK.primarySoft),
    line("--ac-code-bg", DARK.codeBg),
  ];
  return `:root {\n${root.join("\n")}\n}\n:root[data-theme="dark"] {\n${dark.join("\n")}\n}\n`;
}
