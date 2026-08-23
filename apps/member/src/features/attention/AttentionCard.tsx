import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { SEVERITY_COLOR } from "./AttentionItem";
import type { AttentionItem, AttentionSeverity } from "./attentionApi";

const ORDER: AttentionSeverity[] = ["CRITICAL", "ATTENTION", "MONITOR", "INFO"];

/** M-10 — compact home summary: severity counts + the single most severe item
 *  verbatim, "See all". Renders an explicit empty state (FR-113), never hidden. */
export function AttentionCard({ items, onSeeAll, onPressItem }: { items: AttentionItem[]; onSeeAll?: () => void; onPressItem?: (item: AttentionItem) => void }) {
  const t = theme;

  if (items.length === 0) {
    return (
      <View testID="attention-empty" style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Nothing needs attention right now</Text>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Your vehicles are up to date.</Text>
      </View>
    );
  }

  const counts = ORDER.map((sev) => ({ sev, n: items.filter((i) => i.severity === sev).length })).filter((c) => c.n > 0);
  const top = items[0];

  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Needs attention</Text>
        <View style={{ flexDirection: "row", gap: t.spacing.xs }}>
          {counts.map((c) => (
            <View key={c.sev} accessibilityLabel={`${c.n} ${c.sev.toLowerCase()}`} style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: SEVERITY_COLOR[c.sev], alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
              <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{c.n}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Most urgent: ${top.title}`} onPress={() => onPressItem?.(top)} style={{ borderLeftWidth: 4, borderLeftColor: SEVERITY_COLOR[top.severity], paddingLeft: t.spacing.sm }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{top.title}{top.plate ? ` · ${top.plate}` : ""}</Text>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }} numberOfLines={2}>{top.body}</Text>
      </Pressable>

      {onSeeAll && (
        <Pressable accessibilityRole="button" accessibilityLabel="See all attention items" onPress={onSeeAll} style={{ minHeight: 40, justifyContent: "center" }}>
          <Text style={{ ...t.text("body"), color: t.colors.primary, fontWeight: "600" }}>See all {items.length} ›</Text>
        </Pressable>
      )}
    </View>
  );
}
