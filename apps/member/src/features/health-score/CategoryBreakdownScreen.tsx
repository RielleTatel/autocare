import { ScrollView, Text, View } from "react-native";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import { theme } from "../../theme";
import type { CategoryScore, HealthScore } from "./healthScoreApi";

/** M-14 — per-category bars (band-colored fill, weight caption). Task 10 makes
 *  each row tappable to open the tap-to-explain sheet. */
export function CategoryBreakdownScreen({ score }: { score: HealthScore }) {
  const t = theme;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Category breakdown</Text>
      {score.categoryScores.map((c) => (
        <CategoryBar key={c.categoryCode} category={c} />
      ))}
      <View style={{ height: t.spacing.xl }} />
    </ScrollView>
  );
}

export function CategoryBar({ category }: { category: CategoryScore }) {
  const t = theme;
  const bandKey = bandForScore(category.score);
  const fill = vhsBands[bandKey].fill;
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{category.label}</Text>
        <Text style={{ ...t.text("h2"), color: vhsBands[bandKey].text }}>{Math.round(category.score)}</Text>
      </View>
      <View accessibilityRole="progressbar" style={{ height: 12, borderRadius: t.radii.pill, backgroundColor: t.colors.chassis, overflow: "hidden" }}>
        <View testID={`bar-${category.categoryCode}`} style={{ width: `${Math.max(0, Math.min(100, category.score))}%`, height: "100%", backgroundColor: fill }} />
      </View>
      <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Weight {category.weight}% · {category.applicablePoints} points checked</Text>
    </View>
  );
}
