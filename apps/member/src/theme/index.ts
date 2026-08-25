import { colors, spacing, radii, typeScale, targets, vhsBands, elevation, motion, borders } from "@autocare/design-tokens";
import type { TextStyle } from "react-native";

const familyFor = { display: "BarlowSemiCondensed_600SemiBold", body: "System", mono: "IBMPlexMono_500Medium" } as const;

export const theme = {
  colors,
  spacing,
  radii,
  vhsBands,
  elevation,
  motion,
  borders,
  minTarget: targets.memberMinDp,
  text(role: keyof typeof typeScale): TextStyle {
    const t = typeScale[role];
    return {
      fontSize: Math.round(t.size * 16),
      fontWeight: String(t.weight) as TextStyle["fontWeight"],
      fontFamily: familyFor[t.family],
    };
  },
};
