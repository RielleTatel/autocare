import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { ExplainPoint, PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";
import { StarRating } from "./StarRating";
import { ExplainSheet, type ExplainTarget } from "./ExplainSheet";
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
          const bandKey = bandForScore(c.score);
          const rows = byCategory.get(c.categoryCode) ?? [];
          const isOpen = expanded === c.categoryCode;
          return (
            <View key={c.categoryCode} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, overflow: "hidden" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.label}, score ${Math.round(c.score)}. Tap to explain.`}
                onPress={() => openCategory(c)}
                onLongPress={() => rows.length > 0 && setExpanded(isOpen ? null : c.categoryCode)}
                style={{ padding: t.spacing.md, gap: t.spacing.xs }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{c.label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
                    <StarRating score={c.score} size={16} />
                    <Text style={{ ...t.text("h2"), color: vhsBands[bandKey].text }}>{Math.round(c.score)}</Text>
                  </View>
                </View>
                <View style={{ height: 12, borderRadius: t.radii.pill, backgroundColor: t.colors.chassis, overflow: "hidden" }}>
                  <View testID={`bar-${c.categoryCode}`} style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, height: "100%", backgroundColor: vhsBands[bandKey].fill }} />
                </View>
                <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
                  Weight {c.weight}% · {c.applicablePoints} points checked{rows.length > 0 ? " · hold to list components" : ""}
                </Text>
              </Pressable>

              {rows.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel={`${isOpen ? "Hide" : "Show"} ${c.label} components`} onPress={() => setExpanded(isOpen ? null : c.categoryCode)} style={{ paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.xs }}>
                  <Text style={{ ...t.text("label"), color: t.colors.primary }}>{isOpen ? "Hide components ▲" : "Show components ▼"}</Text>
                </Pressable>
              )}

              {isOpen && rows.map((r) => (
                <Pressable
                  key={r.pointCode}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.label}, ${STATUS_WORD[r.status ?? "NOT_APPLICABLE"]}. Tap to explain.`}
                  onPress={() => openResult(r)}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, borderTopWidth: 1, borderTopColor: t.colors.line }}
                >
                  <Text style={{ ...t.text("body"), color: t.colors.ink, flex: 1 }}>{r.label}</Text>
                  <View style={{ borderRadius: t.radii.pill, backgroundColor: statusColor(r.status), paddingHorizontal: t.spacing.sm, paddingVertical: 1 }}>
                    <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{STATUS_WORD[r.status ?? "NOT_APPLICABLE"]}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          );
        })}
        <View style={{ height: t.spacing.xl }} />
      </ScrollView>
      <ExplainSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

/** Kept for callers that render a single category bar standalone. */
export function CategoryBar({ category }: { category: CategoryScore }) {
  const t = theme;
  const bandKey = bandForScore(category.score);
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{category.label}</Text>
        <Text style={{ ...t.text("h2"), color: vhsBands[bandKey].text }}>{Math.round(category.score)}</Text>
      </View>
      <View style={{ height: 12, borderRadius: t.radii.pill, backgroundColor: t.colors.chassis, overflow: "hidden" }}>
        <View testID={`bar-${category.categoryCode}`} style={{ width: `${Math.max(0, Math.min(100, category.score))}%`, height: "100%", backgroundColor: vhsBands[bandKey].fill }} />
      </View>
      <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Weight {category.weight}% · {category.applicablePoints} points checked</Text>
    </View>
  );
}
