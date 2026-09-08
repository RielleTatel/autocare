import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "../components/Icon";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Persistent offline/pending indicator. Tapping it opens the sync queue.
 *
 *  Every drain() caller is fire-and-forget, so a failed upload has no other way
 *  to reach the technician: without the failing/rejected states below, a queue
 *  stuck on an expired token looks identical to one that is merely offline, and
 *  the inspection silently never reaches the member app. */
export function SyncBanner({
  pendingCount,
  rejectedCount = 0,
  lastError = null,
  onPress,
}: {
  pendingCount: number;
  rejectedCount?: number;
  lastError?: string | null;
  onPress?: () => void;
}) {
  const t = fieldTheme;

  // Rejected items outrank a transport error: they need a human decision and
  // will never clear on their own, however healthy the connection becomes.
  let label: string;
  let failing: boolean;
  if (rejectedCount > 0) {
    label = `${rejectedCount} ${plural(rejectedCount, "item was", "items were")} rejected. Tap to review.`;
    failing = true;
  } else if (lastError && pendingCount > 0) {
    label = `Sync failing — ${pendingCount} ${plural(pendingCount, "item", "items")} not uploaded. Tap to review.`;
    failing = true;
  } else if (pendingCount > 0) {
    label = `${pendingCount} ${plural(pendingCount, "item", "items")} waiting to sync`;
    failing = false;
  } else {
    return null;
  }

  const body = (
    <>
      <Icon name={failing ? "alert-triangle" : "refresh-cw"} size={20} color="#FFFFFF" />
      <Text style={{ ...t.text("body", 600), color: "#FFFFFF", textAlign: "center" }}>{label}</Text>
    </>
  );
  const style = {
    backgroundColor: failing ? t.colors.danger : t.colors.primaryDeep,
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
