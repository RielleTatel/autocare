import { Pressable, ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import type { CategoryProgress } from "./draft";

function worstColor(worst: PointStatus | null): string {
  const t = fieldTheme;
  switch (worst) {
    case "CRITICAL": return t.vhsBands.CRITICAL.fill;
    case "ATTENTION": return t.vhsBands.NEEDS_ATTENTION.fill;
    case "MONITOR": return t.vhsBands.FAIR.fill;
    case "GOOD": return t.vhsBands.EXCELLENT.fill;
    default: return t.colors.line;
  }
}

/** F-05 — 10 category tiles with progress rings; tile accent tracks the worst
 *  finding recorded so far (band tokens only). */
export function CategoryNavScreen({
  perCategory, overall, onOpenCategory, onReview,
}: {
  perCategory: CategoryProgress[];
  overall: { answered: number; total: number };
  onOpenCategory(code: string): void;
  onReview(): void;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : Math.round((overall.answered / overall.total) * 100);
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <View style={{ backgroundColor: t.colors.primaryDeep, padding: t.spacing.md, paddingTop: t.spacing.xl }}>
        <Text style={[t.text("h1"), { color: t.colors.onPrimary }]}>Inspection</Text>
        <Text style={[t.text("body"), { color: t.colors.onPrimary, opacity: 0.85 }]}>
          {overall.answered}/{overall.total} points · {pct}%
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        {perCategory.map((cat) => {
          const done = cat.answered === cat.total;
          return (
            <Pressable
              key={cat.code}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label}: ${cat.answered} of ${cat.total} done`}
              onPress={() => onOpenCategory(cat.code)}
              style={{
                minHeight: t.minTarget, backgroundColor: t.colors.surface, borderRadius: t.radii.md,
                borderWidth: 1, borderColor: t.colors.line, borderLeftWidth: 6, borderLeftColor: worstColor(cat.worst),
                padding: t.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <Text style={[t.text("h2"), { color: t.colors.ink }]}>{cat.label}</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[t.text("label"), { color: done ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }]}>
                  {cat.answered}/{cat.total}{done ? " ✓" : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review and submit"
          onPress={onReview}
          style={{ minHeight: t.minTarget, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center", marginTop: t.spacing.sm }}
        >
          <Text style={[t.text("h2"), { color: t.colors.onPrimary }]}>Review & submit</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
