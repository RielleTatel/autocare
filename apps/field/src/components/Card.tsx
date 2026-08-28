import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";

const PAD = { md: fieldTheme.spacing.md, lg: fieldTheme.spacing.lg, none: 0 } as const;

/** Surface container — hairline border, radius 12, no shadow (elevation is line). */
export function Card({
  children, pad = "md", accent, interactive, onPress, style, testID, accessibilityLabel,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const boxStyle: ViewStyle = {
    backgroundColor: fieldTheme.colors.surface,
    borderRadius: fieldTheme.radii.md,
    borderWidth: fieldTheme.borders.hairline,
    borderColor: fieldTheme.colors.line,
    padding: PAD[pad],
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
