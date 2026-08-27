import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { theme } from "../theme";

const PAD = { md: theme.spacing.md, lg: theme.spacing.lg, none: 0 } as const;

/** Surface container — hairline border, radius 12, no shadow (elevation is line). */
export function Card({
  children, pad = "md", accent, interactive, onPress, style, testID, accessibilityLabel,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  /** Renders as a Pressable (adds press feedback); implied when onPress is set. */
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  /** Announced when the card is interactive; it is a button to assistive tech. */
  accessibilityLabel?: string;
}) {
  const boxStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: PAD[pad],
    ...(accent ? { borderLeftWidth: theme.borders.accentRow, borderLeftColor: accent } : null),
    ...style,
  };
  if (interactive || onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [boxStyle, pressed ? { opacity: theme.motion.pressOpacity } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={boxStyle}>{children}</View>;
}
