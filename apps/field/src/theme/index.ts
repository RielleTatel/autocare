import { colors, spacing, radii, typeScale, targets, vhsBands } from "@autocare/design-tokens";
import type { TextStyle } from "react-native";

const familyFor = { display: "BarlowSemiCondensed_600SemiBold", body: "System", mono: "IBMPlexMono_500Medium" } as const;

/** Field theme derives from the shared tokens — never redefines them. It scales
 *  every type role one step larger (×1.125) and enforces 56dp gloved targets. */
export const fieldTheme = {
  colors,
  spacing,
  radii,
  vhsBands,
  minTarget: targets.fieldMinDp,
  text(role: keyof typeof typeScale): TextStyle {
    const t = typeScale[role];
    return {
      fontSize: Math.round(t.size * 16 * 1.125),
      fontWeight: String(t.weight) as TextStyle["fontWeight"],
      fontFamily: familyFor[t.family],
    };
  },
};
