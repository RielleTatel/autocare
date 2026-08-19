import { colors, vhsBands, fontStacks, radii } from "./tokens";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink, "ink-muted": colors.inkMuted, chassis: colors.chassis,
        surface: colors.surface, line: colors.line, primary: colors.primary,
        "primary-deep": colors.primaryDeep, danger: colors.danger, success: colors.success,
        band: Object.fromEntries(Object.entries(vhsBands).map(([k, v]) => [k.toLowerCase().replace("_", "-"), v.fill])),
      },
      fontFamily: { display: fontStacks.display.split(","), body: fontStacks.body.split(","), mono: fontStacks.mono.split(",") },
      borderRadius: { sm: `${radii.sm}px`, md: `${radii.md}px` },
    },
  },
};
