import type { ReactNode } from "react";
import { Pressable, View, type AccessibilityState, type ViewStyle } from "react-native";
import { theme } from "../theme";

const PAD = { md: theme.spacing.md, lg: theme.spacing.lg, none: 0 } as const;

/** Soft two-layer shadow (RN only renders one layer — the wider ambient one —
 *  since shadow* props don't stack); `elevation` is the Android equivalent. */
const SOFT_SHADOW: ViewStyle = {
  shadowColor: theme.colors.ink,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Surface container — radius 20 (28 with `major`), soft shadow over a soft
 *  border (2026 re-skin). `flat` reverts to the shipped hairline with no
 *  shadow, for dense data surfaces. */
export function Card({
  children, pad = "md", accent, interactive, flat, major, disabled, onPress, style, testID,
  accessibilityLabel, accessibilityState,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  /** Renders as a Pressable (adds press feedback); implied when onPress is set. */
  interactive?: boolean;
  /** Drop the soft shadow back to the shipped hairline. */
  flat?: boolean;
  /** Radius 28 instead of the default 20 — major cards, bottom sheets. */
  major?: boolean;
  /** Blocks press and reports the state to assistive tech. */
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  /** Announced when the card is interactive; it is a button to assistive tech. */
  accessibilityLabel?: string;
  /** `selected` / `disabled` for cards used as a choice in a set. Merged over
   *  `disabled` so a caller can pass either without them disagreeing. */
  accessibilityState?: AccessibilityState;
}) {
  const a11yState: AccessibilityState | undefined =
    accessibilityState || disabled ? { disabled: !!disabled, ...accessibilityState } : undefined;
  const boxStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: major ? theme.radii.lg : theme.radii.md,
    borderWidth: 1,
    borderColor: flat ? theme.colors.line : theme.colors.lineSoft,
    padding: PAD[pad],
    ...(flat ? null : SOFT_SHADOW),
    ...(accent ? { borderLeftWidth: theme.borders.accentRow, borderLeftColor: accent } : null),
    ...style,
  };
  if (interactive || onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={a11yState}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [boxStyle, pressed && !disabled ? { opacity: theme.motion.pressOpacity } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} accessibilityState={a11yState} style={boxStyle}>{children}</View>;
}
