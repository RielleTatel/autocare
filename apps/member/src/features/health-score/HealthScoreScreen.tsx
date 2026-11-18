import { ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { ScoreGauge } from "./ScoreGauge";
import { statusColor } from "./statusColor";
import { StarRating } from "./StarRating";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import type { HealthScore, InspectionResultDetail } from "./healthScoreApi";

const OVERRIDE_COPY: Record<string, string> = {
  SAFETY_ATTENTION: "At this inspection, a safety-critical component needed attention, capping the recorded score at 69.",
  SAFETY_CRITICAL: "At this inspection, a safety-critical component was in unsafe condition, capping the recorded score at 49.",
};

const SEVERITY_WORD: Record<string, string> = { CRITICAL: "Critical", ATTENTION: "Attention", MONITOR: "Monitor" };

/** M-13 — gauge + plain-language top-detractor cards + "why this score?" */
export function HealthScoreScreen({
  score, results, resultsLoading = false, resultsError, onRetryResults, onOpenBreakdown, onOpenHistory, onOpenInspectionHistory, onShare, onOpenDiagram,
}: {
  score: HealthScore;
  /** Per-point results, needed to colour the diagram. Absent until an
   *  inspection exists, which is what hides the diagram entry. */
  results?: InspectionResultDetail[];
  resultsLoading?: boolean;
  resultsError?: string | null;
  onRetryResults?: () => void;
  onOpenDiagram?: () => void;
  onOpenBreakdown?: () => void;
  onOpenHistory?: () => void;
  onOpenInspectionHistory?: () => void;
  onShare?: () => void;
}) {
  const t = theme;
  const daysAgo = score.inspectedAt ? Math.max(0, Math.floor((Date.now() - new Date(score.inspectedAt).getTime()) / 86_400_000)) : undefined;

  const hasResults = (results?.length ?? 0) > 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.lg }}>
      <Card pad="lg" style={{ alignItems: "center", gap: t.spacing.sm }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Last full vehicle inspection</Text>
        <ScoreGauge score={score.score} band={score.band} confidence={score.confidence} isStale={score.isStale} daysSinceInspection={daysAgo} />
        {/* Stars are a display transform beside the numeral, never replacing it (§11.5). */}
        <StarRating score={score.score} band={score.band} size={26} />
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
          {score.inspectedAt ? new Date(score.inspectedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" }) : "Full inspection date unavailable"}
        </Text>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>Focused inspections are shown separately in inspection history.</Text>
      </Card>

      {resultsLoading && <Text accessibilityLiveRegion="polite" style={{ ...t.text("body"), color: t.colors.inkMuted }}>Loading inspection findings…</Text>}
      {resultsError && <Card>
        <Text accessibilityRole="alert" style={{ ...t.text("body"), color: t.colors.inkMuted }}>{resultsError}</Text>
        {onRetryResults && <Button onPress={onRetryResults}>Retry findings</Button>}
      </Card>}

      {hasResults && onOpenDiagram && (
        <Button block variant="secondary" icon="car-front" onPress={onOpenDiagram} testID="open-vehicle-diagram">
          View vehicle diagram
        </Button>
      )}

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
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No adverse findings were recorded in this full inspection.</Text>
        </Card>
      )}

      <View style={{ gap: t.spacing.sm }}>
        {onOpenInspectionHistory && <Button block variant="secondary" icon="clipboard-check" onPress={onOpenInspectionHistory}>Inspections & repairs</Button>}
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
