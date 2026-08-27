// The three AutoCare+ faces, imported per-weight so Metro bundles only the four
// faces the type scale actually uses rather than all 18 weights of each family.
//
// React Native does NOT synthesise weights for custom families: each (family,
// weight) pair is its own registered fontFamily. `familyForRole` in ./index.ts
// resolves the type-scale role to one of these exact names, which is why the
// keys here must stay byte-identical to the exported asset names.
import { BarlowSemiCondensed_600SemiBold } from "@expo-google-fonts/barlow-semi-condensed/600SemiBold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";

export const fontAssets = {
  BarlowSemiCondensed_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  // Not a type-scale role of its own — the emphasis weight for inline links and
  // button labels, reached via `theme.text("body", 600)`.
  Inter_600SemiBold,
  IBMPlexMono_500Medium,
} as const;

export type FontName = keyof typeof fontAssets;
