import {
  colors, spacing, radii, typeScale, targets, vhsBands, elevation, motion, borders,
} from "@autocare/design-tokens";
import type { TextStyle } from "react-native";
import type { FontName } from "./fonts";

/** Token family → the @expo-google-fonts family prefix that ships that face.
 *  Set `body` to "System" to revert to the native system stack (see the spec's
 *  flagged deviation). */
const familyPrefix = { display: "BarlowSemiCondensed", body: "Inter", mono: "IBMPlexMono" } as const;

/** Token weight → the suffix @expo-google-fonts uses for that weight. */
const weightSuffix: Record<number, string> = { 400: "400Regular", 500: "500Medium", 600: "600SemiBold" };

/** The field app renders every role one step larger than member. */
const FIELD_SCALE = 1.125;

export function familyForRole(role: keyof typeof typeScale, weight?: 400 | 500 | 600): FontName {
  const t = typeScale[role];
  return `${familyPrefix[t.family]}_${weightSuffix[weight ?? t.weight]}` as FontName;
}

/** Field theme derives from the shared tokens — never redefines them. It scales
 *  every type role one step larger (×1.125) and enforces 56dp gloved targets. */
export const fieldTheme = {
  colors,
  spacing,
  radii,
  vhsBands,
  elevation,
  motion,
  borders,
  minTarget: targets.fieldMinDp,
  /**
   * `weight` overrides the role's default face — use it for the emphasis weight
   * on button labels, never to invent a size/weight pairing outside the scale.
   * Deliberately does not emit `fontWeight`: the weight lives in the family name.
   */
  text(role: keyof typeof typeScale, weight?: 400 | 500 | 600): TextStyle {
    const t = typeScale[role];
    return {
      fontSize: Math.round(t.size * 16 * FIELD_SCALE),
      fontFamily: familyForRole(role, weight),
    };
  },
};
