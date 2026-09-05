import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Plate } from "../../components/Plate";
import type { AnnouncementItem } from "./announcementsApi";

/** Short, absolute date — the feed is chronological, so "2 Sep" reads better than "3 days ago". */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * M-33 (subset) — the member's announcement feed: service-due threads, appointment lifecycle,
 * and shop broadcasts. Threads update in place, so a row is the current state of one service
 * rather than one entry per notification.
 */
export function AnnouncementsScreen({
  items,
  unreadCount,
  refreshing,
  onRefresh,
  onPressItem,
  onMarkAllRead,
}: {
  items: AnnouncementItem[];
  unreadCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onPressItem: (item: AnnouncementItem) => void;
  onMarkAllRead: () => void;
}) {
  const t = theme;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Announcements</Text>
        {unreadCount > 0 && (
          <Pressable testID="mark-all-read" onPress={onMarkAllRead} accessibilityRole="button">
            <Text style={{ ...t.text("label"), color: t.colors.primary }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 && (
        <EmptyState title="No announcements yet" body="Service reminders and shop updates will appear here." />
      )}

      {items.map((a) => (
        <Pressable
          key={a.id}
          testID={`announcement-${a.id}`}
          onPress={() => onPressItem(a)}
          accessibilityRole="button"
          accessibilityLabel={`${a.title}${a.read ? "" : ", unread"}`}
        >
          <Card style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
              {!a.read && (
                <View
                  testID={`unread-dot-${a.id}`}
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary }}
                />
              )}
              <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{a.title}</Text>
              <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{shortDate(a.publishedAt)}</Text>
            </View>

            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{a.body}</Text>

            {a.plate ? (
              <View style={{ flexDirection: "row" }}>
                <Plate>{a.plate}</Plate>
              </View>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
