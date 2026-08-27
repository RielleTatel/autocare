import { colors, spacing, radii, typeScale, targets, vhsBands, elevation, motion, borders } from "@autocare/design-tokens";
import type { TextStyle } from "react-native";
import type { FontName } from "./fonts";

/** Token family → the @expo-google-fonts family prefix that ships that face. */
const familyPrefix = { display: "BarlowSemiCondensed", body: "Inter", mono: "IBMPlexMono" } as const;

/** Token weight → the suffix @expo-google-fonts uses for that weight. */
const weightSuffix: Record<number, string> = { 400: "400Regular", 500: "500Medium", 600: "600SemiBold" };

/**
 * Resolve a type-scale role to a registered RN fontFamily.
 *
 * RN treats every (family, weight) pair as a separate family for custom fonts —
 * setting `fontWeight` alongside a custom `fontFamily` is ignored on iOS and can
 * trigger a wrong-face fallback on Android. So the weight lives in the family
 * name and `text()` deliberately does not emit `fontWeight`.
 */
export function familyForRole(role: keyof typeof typeScale, weight?: 400 | 500 | 600): FontName {
  const t = typeScale[role];
  return `${familyPrefix[t.family]}_${weightSuffix[weight ?? t.weight]}` as FontName;
}

export const theme = {
  colors,
  spacing,
  radii,
  vhsBands,
  elevation,
  motion,
  borders,
  minTarget: targets.memberMinDp,
  /**
   * `weight` overrides the role's default face — use it for the emphasis
   * weight on links and button labels (`text("body", 600)`), never to invent a
   * new size/weight pairing outside the scale.
   */
  text(role: keyof typeof typeScale, weight?: 400 | 500 | 600): TextStyle {
    const t = typeScale[role];
    return {
      fontSize: Math.round(t.size * 16),
      fontFamily: familyForRole(role, weight),
    };
  },
};
