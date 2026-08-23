import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { peso, type RecommendationRow } from "./workOrderApi";

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, ATTENTION: 1, MONITOR: 2 };
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: theme.vhsBands.CRITICAL.fill,
  ATTENTION: theme.vhsBands.NEEDS_ATTENTION.fill,
  MONITOR: theme.vhsBands.FAIR.fill,
};
const SEVERITY_LABEL: Record<string, string> = { CRITICAL: "Critical", ATTENTION: "Needs attention", MONITOR: "Monitor" };

/** M-18 — open recommendations with severity + estimated cost, deep-linking
 *  into booking. */
export function RecommendationsListScreen({
  recommendations, onBookService,
}: {
  recommendations: RecommendationRow[];
  onBookService?: (r: RecommendationRow) => void;
}) {
  const t = theme;
  const open = [...recommendations]
    .filter((r) => ["OPEN", "QUOTED", "DEFERRED"].includes(r.status))
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Recommendations</Text>
      {open.length === 0 && (
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No open recommendations — your vehicle is up to date.</Text>
      )}
      {open.map((r) => (
        <View key={r.id} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SEVERITY_COLOR[r.severity] ?? t.colors.inkMuted }} />
            <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{r.label}</Text>
            {r.estimatedCostCentavos != null && <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>~{peso(r.estimatedCostCentavos)}</Text>}
          </View>
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{r.recommendation}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.text("label"), color: SEVERITY_COLOR[r.severity] ?? t.colors.inkMuted }}>
              {SEVERITY_LABEL[r.severity] ?? r.severity}{r.resurfacedCount > 0 ? ` · seen ${r.resurfacedCount + 1}×` : ""}
            </Text>
            {onBookService && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Book service for ${r.label}`} onPress={() => onBookService(r)}>
                <Text style={{ ...t.text("body"), color: t.colors.primary, fontWeight: "600" }}>Book service →</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
