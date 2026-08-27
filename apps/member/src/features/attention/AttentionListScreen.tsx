import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { AttentionItemRow } from "./AttentionItem";
import { Card } from "../../components/Card";
import { Plate } from "../../components/Plate";
import type { AttentionItem } from "./attentionApi";

/** M-38 — full attention list, grouped by vehicle when the member has >1,
 *  severity-ordered within each group, pull-to-refresh. */
export function AttentionListScreen({
  items, refreshing, onRefresh, onPressItem,
}: {
  items: AttentionItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onPressItem?: (item: AttentionItem) => void;
}) {
  const t = theme;
  const multiVehicle = useMemo(() => new Set(items.map((i) => i.vehicleId)).size > 1, [items]);
  const groups = useMemo(() => {
    if (!multiVehicle) return [{ key: "all", plate: null as string | null, items }];
    const byVehicle = new Map<string, AttentionItem[]>();
    for (const i of items) byVehicle.set(i.vehicleId, [...(byVehicle.get(i.vehicleId) ?? []), i]);
    return [...byVehicle.entries()].map(([key, list]) => ({ key, plate: list[0].plate ?? null, items: list }));
  }, [items, multiVehicle]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
    >
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Needs attention</Text>
      {items.length === 0 && (
        <Card testID="attention-empty">
          <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Nothing needs attention right now</Text>
        </Card>
      )}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: t.spacing.sm }}>
          {/* Grouped by vehicle, so the plate is the group header — the rows
              beneath it don't repeat it. */}
          {g.plate ? <Plate variant="plain" style={{ color: t.colors.inkMuted }}>{g.plate}</Plate> : null}
          {g.items.map((i) => (
            <AttentionItemRow key={i.id} item={i} onPress={onPressItem} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
