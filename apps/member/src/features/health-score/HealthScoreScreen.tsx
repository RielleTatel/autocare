import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { ScoreGauge } from "./ScoreGauge";
import { StarRating } from "./StarRating";
import type { HealthScore } from "./healthScoreApi";

const OVERRIDE_COPY: Record<string, string> = {
  SAFETY_ATTENTION: "A safety-critical component needs attention, so the score is capped at 69 until it is resolved — no matter how good everything else is.",
  SAFETY_CRITICAL: "A safety-critical component is in unsafe condition, so the score is capped at 49 until it is repaired.",
};

function severityColor(status: string): string {
  switch (status) {
    case "CRITICAL": return theme.vhsBands.CRITICAL.fill;
    case "ATTENTION": return theme.vhsBands.NEEDS_ATTENTION.fill;
    case "MONITOR": return theme.vhsBands.FAIR.fill;
    default: return theme.colors.inkMuted;
  }
}

/** M-13 — gauge + plain-language top-detractor cards + "why this score?" */
export function HealthScoreScreen({
  score, onOpenBreakdown, onOpenHistory, onShare,
}: {
  score: HealthScore;
  onOpenBreakdown?: () => void;
  onOpenHistory?: () => void;
  onShare?: () => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const t = theme;
  const daysAgo = Math.round((Date.now() - new Date(score.computedAt).getTime()) / 86_400_000);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.lg }}>
      <View style={{ alignItems: "center", paddingTop: t.spacing.md, gap: t.spacing.xs }}>
        <ScoreGauge score={score.score} band={score.band} confidence={score.confidence} isStale={score.isStale} daysSinceInspection={daysAgo} />
        {/* Stars are a display transform beside the numeral, never replacing it (§11.5). */}
        <StarRating score={score.score} band={score.band} size={26} />
      </View>

      {score.overrideApplied !== "NONE" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Why this score"
          onPress={() => setWhyOpen((v) => !v)}
          style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}
        >
          <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Why this score? {whyOpen ? "▲" : "▼"}</Text>
          {whyOpen && <Text style={{ ...t.text("body"), color: t.colors.inkMuted, marginTop: t.spacing.xs }}>{OVERRIDE_COPY[score.overrideApplied]}</Text>}
        </Pressable>
      )}

      <View style={{ gap: t.spacing.sm }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Top things to look at</Text>
        {score.topDetractors.length === 0 && (
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No adverse findings — everything checked out.</Text>
        )}
        {score.topDetractors.map((d) => {
          const rec = score.recommendations.find((r) => r.pointCode === d.pointCode);
          return (
            <View key={d.pointCode} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, flexDirection: "row", gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
                  <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{d.label}</Text>
                  <View style={{ borderRadius: t.radii.pill, backgroundColor: severityColor(d.status), paddingHorizontal: t.spacing.sm, paddingVertical: 1 }}>
                    <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{d.status === "CRITICAL" ? "Critical" : d.status === "ATTENTION" ? "Attention" : "Monitor"}</Text>
                  </View>
                </View>
                <Text style={{ ...t.text("body"), color: t.colors.inkMuted, marginTop: t.spacing.xs }}>{rec?.recommendation ?? d.recommendation}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ gap: t.spacing.sm }}>
        {onOpenBreakdown && (
          <Pressable accessibilityRole="button" onPress={onOpenBreakdown} style={btn(t, "primary")}>
            <Text style={{ ...t.text("h2"), color: t.colors.onPrimary }}>See category breakdown</Text>
          </Pressable>
        )}
        {onOpenHistory && (
          <Pressable accessibilityRole="button" onPress={onOpenHistory} style={btn(t, "outline")}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Score history</Text>
          </Pressable>
        )}
        {onShare && (
          <Pressable accessibilityRole="button" onPress={onShare} style={btn(t, "outline")}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Share certificate</Text>
          </Pressable>
        )}
      </View>
      <View style={{ height: t.spacing.xl }} />
    </ScrollView>
  );
}

function btn(t: typeof theme, kind: "primary" | "outline") {
  return {
    minHeight: t.minTarget,
    borderRadius: t.radii.md,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: kind === "primary" ? t.colors.primary : t.colors.surface,
    borderWidth: kind === "outline" ? 1 : 0,
    borderColor: t.colors.line,
  };
}
