import type { ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { theme } from "../theme";

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";

type Look = { bg: string; fg: string };

/** warn uses the FAIR band token (product data); the others are brand/semantic. */
const TONE: Record<Tone, Look> = {
  neutral: { bg: theme.colors.chassis, fg: theme.colors.ink },
  info: { bg: theme.colors.primary, fg: "#FFFFFF" },
  success: { bg: theme.colors.success, fg: "#FFFFFF" },
  warn: { bg: theme.vhsBands.FAIR.fill, fg: "#FFFFFF" },
  danger: { bg: theme.colors.danger, fg: "#FFFFFF" },
  solid: { bg: theme.colors.primary, fg: "#FFFFFF" },
  solidDeep: { bg: theme.colors.primaryDeep, fg: "#FFFFFF" },
};

/** Mono-caps lifecycle pill — work orders, trips, roadside, statuses. */
export function StatusPill({
  children, tone = "neutral", style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const t = TONE[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: t.bg,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        ...style,
      }}
    >
      <Text style={{ ...theme.text("label"), color: t.fg }}>{children}</Text>
    </View>
  );
}
