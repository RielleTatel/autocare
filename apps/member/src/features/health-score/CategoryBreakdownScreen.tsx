import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { ExplainPoint, PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";
import { ExplainSheet, type ExplainTarget } from "./ExplainSheet";
import { Card } from "../../components/Card";
import { CategoryBar } from "../../components/CategoryBar";
import type { CategoryScore, HealthScore, InspectionResultDetail } from "./healthScoreApi";

function statusColor(status: PointStatus | null): string {
  switch (status) {
    case "CRITICAL": return vhsBands.CRITICAL.fill;
    case "ATTENTION": return vhsBands.NEEDS_ATTENTION.fill;
    case "MONITOR": return vhsBands.FAIR.fill;
    case "GOOD": return vhsBands.EXCELLENT.fill;
    default: return theme.colors.inkMuted;
  }
}
const STATUS_WORD: Record<string, string> = { GOOD: "Good", MONITOR: "Monitor", ATTENTION: "Attention", CRITICAL: "Critical", NOT_APPLICABLE: "N/A" };

function toExplainPoint(r: InspectionResultDetail): ExplainPoint {
  return {
    code: r.pointCode,
    label: r.label,
    unit: r.unit ?? undefined,
    thresholds: r.thresholds
      ? { direction: r.thresholds.direction as "HIGHER_BETTER" | "LOWER_BETTER", good: r.thresholds.good, monitor: r.thresholds.monitor, attention: r.thresholds.attention }
      : undefined,
    templates: (r.templates as ExplainPoint["templates"]) ?? undefined,
  };
}

/** M-14 — per-category bars, and EVERY category row plus EVERY constituent
 *  result beneath it is independently tappable (FR-115 works for all
 *  components, healthy ones included), opening the ExplainSheet. */
export function CategoryBreakdownScreen({ score, results = [] }: { score: HealthScore; results?: InspectionResultDetail[] }) {
  const t = theme;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [target, setTarget] = useState<ExplainTarget | null>(null);

  const byCategory = useMemo(() => {
    const m = new Map<string, InspectionResultDetail[]>();
    for (const r of results) m.set(r.categoryCode, [...(m.get(r.categoryCode) ?? []), r]);
    return m;
  }, [results]);

  const openCategory = (c: CategoryScore) => {
    setTarget({
      point: { code: c.categoryCode, label: c.label },
      status: (bandForScore(c.score) === "EXCELLENT" || bandForScore(c.score) === "GOOD" ? "GOOD" : bandForScore(c.score) === "FAIR" ? "MONITOR" : "ATTENTION") as PointStatus,
      score: c.score,
    });
  };
  const openResult = (r: InspectionResultDetail) => {
    setTarget({
      point: toExplainPoint(r),
      status: (r.status ?? "NOT_APPLICABLE") as PointStatus,
      measuredValue: r.measuredValue ?? undefined,
      photoUrl: r.photoUrls[0],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Category breakdown</Text>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Tap any category or component to see what it means.</Text>
        {score.categoryScores.map((c) => {
          const rows = byCategory.get(c.categoryCode) ?? [];
          const isOpen = expanded === c.categoryCode;
          return (
            <Card key={c.categoryCode} pad="none" style={{ overflow: "hidden" }}>
              <Pressable
                onLongPress={() => rows.length > 0 && setExpanded(isOpen ? null : c.categoryCode)}
                style={{ padding: t.spacing.md }}
              >
                <CategoryBar
                  testID={`bar-${c.categoryCode}`}
                  label={c.label}
                  score={c.score}
                  weight={c.weight}
                  points={c.applicablePoints}
                  onPress={() => openCategory(c)}
                />
              </Pressable>

              {rows.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel={`${isOpen ? "Hide" : "Show"} ${c.label} components`} onPress={() => setExpanded(isOpen ? null : c.categoryCode)} style={{ paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.sm }}>
                  <Text style={{ ...t.text("label"), color: t.colors.primary }}>{isOpen ? "Hide components" : "Show components"}</Text>
                </Pressable>
              )}

              {isOpen && rows.map((r) => (
                <Pressable
                  key={r.pointCode}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}, ${STATUS_WORD[r.status ?? "NOT_APPLICABLE"]}. Tap to explain.`}
                  onPress={() => openResult(r)}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.line }}
                >
                  <Text style={{ ...t.text("body"), color: t.colors.ink, flex: 1 }}>{r.label}</Text>
                  {/* Band-coloured rather than a generic StatusPill tone: point
                      status is score data, and collapsing CRITICAL and ATTENTION
                      into one "danger" tone would lose a safety distinction. */}
                  <View style={{ borderRadius: t.radii.pill, backgroundColor: statusColor(r.status), paddingHorizontal: t.spacing.sm, paddingVertical: 1 }}>
                    <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{STATUS_WORD[r.status ?? "NOT_APPLICABLE"]}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          );
        })}
        <View style={{ height: t.spacing.xl }} />
      </ScrollView>
      <ExplainSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}
