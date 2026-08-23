import { Pressable, StyleSheet, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { SyncBanner } from "../../shared/SyncBanner";
import { syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";

export interface StaffHomeScreenProps {
  name: string | null;
  role: string;
  onStartInspection?: () => void;
  onOpenSyncQueue?: () => void;
}

export function StaffHomeScreen({ name, role, onStartInspection, onOpenSyncQueue }: StaffHomeScreenProps) {
  const t = fieldTheme;
  const sync = useSyncStatus(syncProcessor);
  return (
    <View style={styles.screen}>
      <SyncBanner pendingCount={sync.pendingCount} />
      <View style={styles.body}>
        <Text style={styles.heading} testID="staff-home-heading">
          Signed in as {name ?? "Staff"} — {role}
        </Text>
        {onStartInspection && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start inspection"
            onPress={onStartInspection}
            style={[styles.action, { backgroundColor: t.colors.primary }]}
          >
            <Text style={[t.text("h2"), { color: t.colors.onPrimary }]}>🔧 Start inspection</Text>
          </Pressable>
        )}
        {onOpenSyncQueue && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open sync queue"
            onPress={onOpenSyncQueue}
            style={[styles.action, { backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.line }]}
          >
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>
              ⇅ Sync queue{sync.pendingCount > 0 ? ` (${sync.pendingCount})` : ""}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: fieldTheme.colors.chassis,
  },
  body: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: fieldTheme.spacing.lg,
    gap: fieldTheme.spacing.md,
  },
  heading: {
    ...fieldTheme.text("h1"),
    color: fieldTheme.colors.primaryDeep,
    textAlign: "center",
  },
  action: {
    minHeight: fieldTheme.minTarget,
    borderRadius: fieldTheme.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
