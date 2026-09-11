import { colors, vhsBands, fontStacks, radii, radiiLegacy, spacing, elevation } from "./tokens";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink, "ink-muted": colors.inkMuted, "ink-faint": colors.inkFaint, chassis: colors.chassis,
        surface: colors.surface, "surface-soft": colors.surfaceSoft, "surface-sunken": colors.surfaceSunken,
        line: colors.line, "line-soft": colors.lineSoft,
        primary: colors.primary, "primary-deep": colors.primaryDeep, "primary-soft": colors.primarySoft,
        ember: colors.ember, danger: colors.danger, success: colors.success,
        "action-hover": "#C21F36",
        band: Object.fromEntries(
          Object.entries(vhsBands).flatMap(([k, v]) => {
            const s = k.toLowerCase().replace("_", "-");
            return [[s, v.fill], [`${s}-text`, v.text], [`${s}-soft`, v.soft]];
          }),
        ),
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      fontFamily: { display: fontStacks.display.split(","), body: fontStacks.body.split(","), mono: fontStacks.mono.split(",") },
      borderRadius: {
        xs: `${radii.xs}px`, sm: `${radii.sm}px`, md: `${radii.md}px`, lg: `${radii.lg}px`, xl: `${radii.xl}px`,
        pill: `${radii.pill}px`, "legacy-sm": `${radiiLegacy.sm}px`, "legacy-md": `${radiiLegacy.md}px`,
      },
      boxShadow: { flat: elevation.flat, card: elevation.card, raised: elevation.raised, nav: elevation.nav, sheet: elevation.sheet },
    },
  },
};
