import { Text, View } from "react-native";
import { colors, spacing } from "@autocare/design-tokens";

export function SyncBanner({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) return null;
  return (
    <View style={{ backgroundColor: colors.primaryDeep, padding: spacing.sm }} accessibilityRole="alert">
      <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600", textAlign: "center" }}>
        {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync
      </Text>
    </View>
  );
}
