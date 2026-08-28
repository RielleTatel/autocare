import { ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { ScoreGauge } from "./ScoreGauge";
import { statusColor } from "./statusColor";
import { StarRating } from "./StarRating";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import type { HealthScore } from "./healthScoreApi";

const OVERRIDE_COPY: Record<string, string> = {
  SAFETY_ATTENTION: "A safety-critical component needs attention, so the score is capped at 69 until it is resolved — no matter how good everything else is.",
  SAFETY_CRITICAL: "A safety-critical component is in unsafe condition, so the score is capped at 49 until it is repaired.",
};

const SEVERITY_WORD: Record<string, string> = { CRITICAL: "Critical", ATTENTION: "Attention", MONITOR: "Monitor" };

/** M-13 — gauge + plain-language top-detractor cards + "why this score?" */
export function HealthScoreScreen({
  score, onOpenBreakdown, onOpenHistory, onShare,
}: {
  score: HealthScore;
  onOpenBreakdown?: () => void;
  onOpenHistory?: () => void;
  onShare?: () => void;
}) {
  const t = theme;
  const daysAgo = Math.round((Date.now() - new Date(score.computedAt).getTime()) / 86_400_000);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.lg }}>
      <Card pad="lg" style={{ alignItems: "center", gap: t.spacing.sm }}>
        <ScoreGauge score={score.score} band={score.band} confidence={score.confidence} isStale={score.isStale} daysSinceInspection={daysAgo} />
        {/* Stars are a display transform beside the numeral, never replacing it (§11.5). */}
        <StarRating score={score.score} band={score.band} size={26} />
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
          {daysAgo === 0 ? "Inspected today" : `Inspected ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`}
        </Text>
      </Card>

      {/* The mockup's "Why NN?" card: the cap explanation and the detractors that
          caused it read as one answer, always open. Previously the explanation was
          behind an accordion and the findings sat in a separate section below, so
          the member had to assemble the reason themselves. */}
      {(score.overrideApplied !== "NONE" || score.topDetractors.length > 0) && (
        <Card testID="why-this-score">
          <Text style={{ ...t.text("h2"), color: t.colors.ink, marginBottom: 4 }}>Why {score.score}?</Text>
          {score.overrideApplied !== "NONE" && (
            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{OVERRIDE_COPY[score.overrideApplied]}</Text>
          )}
          {score.topDetractors.length > 0 && (
            <View style={{ marginTop: t.spacing.sm }}>
              {score.topDetractors.map((d) => {
                const rec = score.recommendations.find((r) => r.pointCode === d.pointCode);
                return (
                  <View
                    key={d.pointCode}
                    style={{
                      flexDirection: "row", gap: 10, alignItems: "flex-start",
                      paddingVertical: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.line,
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: statusColor(d.status) }} />
                    <Text style={{ ...t.text("body"), color: t.colors.inkMuted, flex: 1, fontSize: 14 }}>
                      <Text style={{ color: t.colors.ink }}>{d.label} — {SEVERITY_WORD[d.status] ?? d.status}.</Text>
                      {" "}{rec?.recommendation ?? d.recommendation}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      )}

      {score.topDetractors.length === 0 && score.overrideApplied === "NONE" && (
        <Card>
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No adverse findings — everything checked out.</Text>
        </Card>
      )}

      <View style={{ gap: t.spacing.sm }}>
        {onOpenBreakdown && (
          <Button block icon="list-tree" onPress={onOpenBreakdown}>See category breakdown</Button>
        )}
        <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
          {onOpenHistory && (
            <View style={{ flex: 1 }}>
              <Button block variant="secondary" icon="trending-up" onPress={onOpenHistory}>History</Button>
            </View>
          )}
          {onShare && (
            <View style={{ flex: 1 }}>
              <Button block variant="secondary" icon="share-2" onPress={onShare}>Share</Button>
            </View>
          )}
        </View>
      </View>
      <View style={{ height: t.spacing.xl }} />
    </ScrollView>
  );
}
