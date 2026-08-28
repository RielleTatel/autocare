import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "../components/Icon";

/** Persistent offline/pending indicator. Tapping it opens the sync queue. */
export function SyncBanner({ pendingCount, onPress }: { pendingCount: number; onPress?: () => void }) {
  const t = fieldTheme;
  if (pendingCount === 0) return null;

  const label = `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to sync`;
  const body = (
    <>
      <Icon name="refresh-cw" size={20} color="#FFFFFF" />
      <Text style={{ ...t.text("body", 600), color: "#FFFFFF", textAlign: "center" }}>{label}</Text>
    </>
  );
  const style = {
    backgroundColor: t.colors.primaryDeep,
    padding: t.spacing.sm,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: t.spacing.sm,
  };

  if (!onPress) {
    return <View accessibilityRole="alert" style={style}>{body}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </Pressable>
  );
}
