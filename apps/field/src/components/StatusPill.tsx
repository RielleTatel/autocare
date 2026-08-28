import type { ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";
type Look = { bg: string; fg: string };

/** warn uses the FAIR band token (product data); the others are brand/semantic. */
const TONE: Record<Tone, Look> = {
  neutral: { bg: fieldTheme.colors.chassis, fg: fieldTheme.colors.ink },
  info: { bg: fieldTheme.colors.primary, fg: "#FFFFFF" },
  success: { bg: fieldTheme.colors.success, fg: "#FFFFFF" },
  warn: { bg: fieldTheme.vhsBands.FAIR.fill, fg: "#FFFFFF" },
  danger: { bg: fieldTheme.colors.danger, fg: "#FFFFFF" },
  solid: { bg: fieldTheme.colors.primary, fg: "#FFFFFF" },
  solidDeep: { bg: fieldTheme.colors.primaryDeep, fg: "#FFFFFF" },
};

/** Mono-caps lifecycle pill — work orders, sync entries, appointment states. */
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
        borderRadius: fieldTheme.radii.pill,
        paddingHorizontal: fieldTheme.spacing.sm,
        paddingVertical: 2,
        ...style,
      }}
    >
      <Text style={{ ...fieldTheme.text("label"), color: t.fg }}>{children}</Text>
    </View>
  );
}
