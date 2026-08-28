import { ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { Icon } from "../../components/Icon";
import { statusColor } from "../../components/StatusChip";
import type { CategoryProgress } from "./draft";

/** Tile accent tracks the worst finding recorded so far — band tokens only. */
function worstColor(worst: PointStatus | null): string {
  return worst ? statusColor(worst) : fieldTheme.colors.line;
}

/** F-05 — category tiles with progress; the accent edge carries the worst
 *  finding so far so a mechanic can see where the trouble is at a glance. */
export function CategoryNavScreen({
  perCategory, overall, onOpenCategory, onReview, onBack,
}: {
  perCategory: CategoryProgress[];
  overall: { answered: number; total: number };
  onOpenCategory(code: string): void;
  onReview(): void;
  onBack?(): void;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : (overall.answered / overall.total) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Inspection" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
          {overall.answered} of {overall.total} points recorded
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: overall.total, now: overall.answered }}
          style={{ height: 8, borderRadius: t.radii.pill, backgroundColor: t.colors.line, overflow: "hidden" }}
        >
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: t.colors.primary }} />
        </View>

        {perCategory.map((cat) => {
          const done = cat.answered === cat.total;
          return (
            <Card
              key={cat.code}
              interactive
              accessibilityLabel={`${cat.label}: ${cat.answered} of ${cat.total} done`}
              onPress={() => onOpenCategory(cat.code)}
              accent={worstColor(cat.worst)}
              style={{ minHeight: t.minTarget, flexDirection: "row", alignItems: "center", gap: t.spacing.md }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{cat.label}</Text>
                {cat.labelFil ? (
                  <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{cat.labelFil}</Text>
                ) : null}
              </View>
              <Text style={{ ...t.text("code"), color: done ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }}>
                {cat.answered}/{cat.total}
              </Text>
              <Icon name="chevron-right" size={22} color={t.colors.inkMuted} />
            </Card>
          );
        })}

        <Button icon="clipboard-check" onPress={onReview} style={{ marginTop: t.spacing.sm }}>
          Review &amp; submit
        </Button>
      </ScrollView>
    </View>
  );
}
