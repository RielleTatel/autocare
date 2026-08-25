import { colors, vhsBands, fontStacks, radii, spacing, elevation } from "./tokens";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink, "ink-muted": colors.inkMuted, chassis: colors.chassis,
        surface: colors.surface, line: colors.line, primary: colors.primary,
        "primary-deep": colors.primaryDeep, danger: colors.danger, success: colors.success,
        "action-hover": "#0C4E90",
        band: Object.fromEntries(
          Object.entries(vhsBands).flatMap(([k, v]) => {
            const s = k.toLowerCase().replace("_", "-");
            return [[s, v.fill], [`${s}-text`, v.text]];
          }),
        ),
      },
      spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`])),
      fontFamily: { display: fontStacks.display.split(","), body: fontStacks.body.split(","), mono: fontStacks.mono.split(",") },
      borderRadius: { sm: `${radii.sm}px`, md: `${radii.md}px`, pill: `${radii.pill}px` },
      boxShadow: { card: elevation.card, raised: elevation.raised, sheet: elevation.sheet },
    },
  },
};
