import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { AttentionItemRow } from "./AttentionItem";
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
        <View testID="attention-empty" style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}>
          <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Nothing needs attention right now</Text>
        </View>
      )}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: t.spacing.sm }}>
          {g.plate && <Text style={{ ...t.text("h2"), color: t.colors.inkMuted, fontFamily: "IBMPlexMono_500Medium" }}>{g.plate}</Text>}
          {g.items.map((i) => (
            <AttentionItemRow key={i.id} item={i} showPlate={!multiVehicle ? false : false} onPress={onPressItem} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
