import { colors, vhsBands, fontStacks, typeScale, spacing, radii, elevation, motion, borders, targets } from "./tokens";

/** Dark-theme neutral/brand overrides — verbatim from the design system's
 *  colors.css. Band fills never change across theme or print. */
const DARK = {
  ink: "#E4EAEF", inkMuted: "#9AAAB6", chassis: "#101820", surface: "#1A242E",
  line: "#2C3947", primary: "#4C95DB", primaryDeep: "#0A2E4F", codeBg: "#232F3A",
} as const;

/** Renders every design token as a CSS custom-property stylesheet: a light
 *  `:root` block plus a `:root[data-theme="dark"]` override. Every value is
 *  derived from the token objects — the single source of truth. */
export function toCssVars(): string {
  const line = (k: string, v: string) => `  ${k}: ${v};`;
  const root: string[] = [
    line("--ac-ink", colors.ink), line("--ac-ink-muted", colors.inkMuted),
    line("--ac-chassis", colors.chassis), line("--ac-surface", colors.surface),
    line("--ac-line", colors.line), line("--ac-primary", colors.primary),
    line("--ac-primary-deep", colors.primaryDeep), line("--ac-on-primary", colors.onPrimary),
    line("--ac-danger", colors.danger), line("--ac-success", colors.success),
    line("--ac-code-bg", "#E4E9EC"),
    // masthead / deep-chrome support tints
    line("--ac-on-deep-body", "#B9CCDD"), line("--ac-on-deep-meta", "#7E9BB4"),
    // band fill + text
    ...Object.entries(vhsBands).flatMap(([k, v]) => {
      const s = k.toLowerCase().replace("_", "-");
      return [line(`--ac-band-${s}`, v.fill), line(`--ac-band-${s}-text`, v.text)];
    }),
    line("--ac-band-on", "#FFFFFF"),
    // severity aliases
    line("--ac-sev-critical", "var(--ac-band-critical)"),
    line("--ac-sev-attention", "var(--ac-band-needs-attention)"),
    line("--ac-sev-monitor", "var(--ac-band-fair)"),
    line("--ac-sev-info", "var(--ac-primary)"),
    // semantic color aliases
    line("--text-primary", "var(--ac-ink)"), line("--text-muted", "var(--ac-ink-muted)"),
    line("--text-on-primary", "var(--ac-on-primary)"), line("--text-link", "var(--ac-primary)"),
    line("--text-danger", "var(--ac-danger)"),
    line("--surface-app", "var(--ac-chassis)"), line("--surface-card", "var(--ac-surface)"),
    line("--surface-sunken", "var(--ac-chassis)"), line("--surface-chrome", "var(--ac-primary-deep)"),
    line("--surface-code", "var(--ac-code-bg)"),
    line("--border-hairline", "var(--ac-line)"), line("--border-strong", "var(--ac-ink)"),
    line("--action-primary", "var(--ac-primary)"), line("--action-primary-hover", "#0C4E90"),
    line("--action-primary-press", "#093C70"), line("--action-destructive", "var(--ac-danger)"),
    line("--action-disabled-bg", "var(--ac-line)"), line("--action-disabled-fg", "var(--ac-ink-muted)"),
    line("--focus-ring", "var(--ac-primary)"),
    // spacing
    ...Object.entries(spacing).map(([k, v]) => line(`--ac-space-${k}`, `${v}px`)),
    // radii
    line("--ac-radius-sm", `${radii.sm}px`), line("--ac-radius-md", `${radii.md}px`),
    line("--ac-radius-pill", `${radii.pill}px`),
    // targets + borders
    line("--ac-target-member", `${targets.memberMinDp}px`), line("--ac-target-field", `${targets.fieldMinDp}px`),
    line("--ac-hairline", `${borders.hairline}px`), line("--ac-border-control", `${borders.control}px`),
    line("--ac-border-accent", `${borders.accent}px`), line("--ac-border-accent-row", `${borders.accentRow}px`),
    line("--ac-gauge-stroke", `${borders.gaugeStroke}px`),
    // fonts + type
    line("--ac-font-display", fontStacks.display), line("--ac-font-body", fontStacks.body),
    line("--ac-font-mono", fontStacks.mono),
    ...Object.entries(typeScale).map(([k, v]) => line(`--ac-size-${k}`, `${v.size}rem`)),
    // elevation
    line("--ac-elevation-flat", elevation.flat), line("--ac-elevation-card", elevation.card),
    line("--ac-elevation-raised", elevation.raised), line("--ac-elevation-sheet", elevation.sheet),
    line("--ac-scrim", elevation.scrim),
    // motion
    line("--ac-duration-instant", motion.durInstant), line("--ac-duration-fast", motion.durFast),
    line("--ac-duration-base", motion.durBase), line("--ac-duration-sheet", motion.durSheet),
    line("--ac-ease-standard", motion.easeStandard), line("--ac-ease-out", motion.easeOut),
    line("--ac-press-opacity", String(motion.pressOpacity)),
  ];
  const dark: string[] = [
    line("--ac-ink", DARK.ink), line("--ac-ink-muted", DARK.inkMuted),
    line("--ac-chassis", DARK.chassis), line("--ac-surface", DARK.surface),
    line("--ac-line", DARK.line), line("--ac-primary", DARK.primary),
    line("--ac-primary-deep", DARK.primaryDeep), line("--ac-code-bg", DARK.codeBg),
  ];
  return `:root {\n${root.join("\n")}\n}\n:root[data-theme="dark"] {\n${dark.join("\n")}\n}\n`;
}
