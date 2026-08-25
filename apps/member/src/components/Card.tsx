import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { theme } from "../theme";

const PAD = { md: theme.spacing.md, lg: theme.spacing.lg, none: 0 } as const;

/** Surface container — hairline border, radius 12, no shadow (elevation is line). */
export function Card({
  children, pad = "md", accent, style,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.line,
        padding: PAD[pad],
        ...(accent ? { borderLeftWidth: theme.borders.accentRow, borderLeftColor: accent } : null),
        ...style,
      }}
    >
      {children}
    </View>
  );
}
