import { Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../theme";

export const STATUS_LABELS: Record<PointStatus, string> = {
  GOOD: "Good",
  MONITOR: "Monitor",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
  NOT_APPLICABLE: "N/A",
};

/**
 * Point status → band fill. These are protected band tokens: the chip is
 * reporting inspection data, which is the one thing band colour is allowed to
 * mean. NOT_APPLICABLE is deliberately neutral — it is an absence, not a grade.
 */
export function statusColor(s: PointStatus): string {
  const t = fieldTheme;
  switch (s) {
    case "GOOD": return t.vhsBands.EXCELLENT.fill;
    case "MONITOR": return t.vhsBands.FAIR.fill;
    case "ATTENTION": return t.vhsBands.NEEDS_ATTENTION.fill;
    case "CRITICAL": return t.vhsBands.CRITICAL.fill;
    case "NOT_APPLICABLE": return t.colors.inkMuted;
  }
}

export function StatusChip({ status, testID }: { status: PointStatus; testID?: string }) {
  const t = fieldTheme;
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: statusColor(status),
        borderRadius: t.radii.pill,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.xs,
      }}
    >
      <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}
