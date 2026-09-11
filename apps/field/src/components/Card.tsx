import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";

const PAD = { md: fieldTheme.spacing.md, lg: fieldTheme.spacing.lg, none: 0 } as const;

/** Soft two-layer shadow (RN only renders one layer — the wider ambient one —
 *  since shadow* props don't stack); `elevation` is the Android equivalent. */
const SOFT_SHADOW: ViewStyle = {
  shadowColor: fieldTheme.colors.ink,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Surface container — radius 20 (28 with `major`), soft shadow over a soft
 *  border (2026 re-skin). `flat` reverts to the shipped hairline with no
 *  shadow, for dense data surfaces. */
export function Card({
  children, pad = "md", accent, interactive, flat, major, onPress, style, testID, accessibilityLabel,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  interactive?: boolean;
  /** Drop the soft shadow back to the shipped hairline. */
  flat?: boolean;
  /** Radius 28 instead of the default 20 — major cards, bottom sheets. */
  major?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const boxStyle: ViewStyle = {
    backgroundColor: fieldTheme.colors.surface,
    borderRadius: major ? fieldTheme.radii.lg : fieldTheme.radii.md,
    borderWidth: fieldTheme.borders.hairline,
    borderColor: flat ? fieldTheme.colors.line : fieldTheme.colors.lineSoft,
    padding: PAD[pad],
    ...(flat ? null : SOFT_SHADOW),
    ...(accent ? { borderLeftWidth: fieldTheme.borders.accentRow, borderLeftColor: accent } : null),
    ...style,
  };
  if (interactive || onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [boxStyle, pressed ? { opacity: fieldTheme.motion.pressOpacity } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={boxStyle}>{children}</View>;
}
