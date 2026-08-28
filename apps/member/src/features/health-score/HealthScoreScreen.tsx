import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { ScoreGauge } from "./ScoreGauge";
import { statusColor } from "./statusColor";
import { StarRating } from "./StarRating";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { VehicleDiagram } from "./VehicleDiagram";
import { DiagramZoneSheet } from "./DiagramZoneSheet";
import { ExplainSheet, type ExplainTarget } from "./ExplainSheet";
import type { ShapeId } from "./diagramGeometry";
import type { HealthScore, InspectionResultDetail } from "./healthScoreApi";

const OVERRIDE_COPY: Record<string, string> = {
  SAFETY_ATTENTION: "A safety-critical component needs attention, so the score is capped at 69 until it is resolved — no matter how good everything else is.",
  SAFETY_CRITICAL: "A safety-critical component is in unsafe condition, so the score is capped at 49 until it is repaired.",
};

const SEVERITY_WORD: Record<string, string> = { CRITICAL: "Critical", ATTENTION: "Attention", MONITOR: "Monitor" };

/** M-13 — gauge + plain-language top-detractor cards + "why this score?" */
export function HealthScoreScreen({
  score, results, onOpenBreakdown, onOpenHistory, onShare,
}: {
  score: HealthScore;
  /** Per-point results, needed to colour the diagram. Absent until an
   *  inspection exists, which is what hides the Diagram toggle. */
  results?: InspectionResultDetail[];
  onOpenBreakdown?: () => void;
  onOpenHistory?: () => void;
  onShare?: () => void;
}) {
  const t = theme;
  const daysAgo = Math.round((Date.now() - new Date(score.computedAt).getTime()) / 86_400_000);

  const [view, setView] = useState<"list" | "diagram">("list");
  const [openShape, setOpenShape] = useState<ShapeId | null>(null);
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  const hasResults = (results?.length ?? 0) > 0;

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

      {/* Diagram is an alternative view of the same inspection, not a new screen
          (M-39). Hidden entirely until an inspection exists, so a new vehicle
          never shows an empty car. */}
      {hasResults && (
        <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
          {(["list", "diagram"] as const).map((v) => (
            <Pressable
              key={v}
              testID={`view-toggle-${v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
              accessibilityLabel={v === "list" ? "List view" : "Diagram view"}
              onPress={() => setView(v)}
              style={{
                flex: 1,
                minHeight: t.minTarget,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: t.radii.md,
                backgroundColor: view === v ? t.colors.primary : t.colors.surface,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            >
              <Text style={{ ...t.text("label"), color: view === v ? "#FFFFFF" : t.colors.ink }}>
                {v === "list" ? "List" : "Diagram"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {hasResults && view === "diagram" && (
        <Card pad="lg">
          <VehicleDiagram results={results!} onShapePress={setOpenShape} />
          <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.sm }}>
            Tap a part of the car to see what was checked there.
          </Text>
        </Card>
      )}

      {/* The mockup's "Why NN?" card: the cap explanation and the detractors that
          caused it read as one answer, always open. Previously the explanation was
          behind an accordion and the findings sat in a separate section below, so
          the member had to assemble the reason themselves. */}
      {view === "list" && (score.overrideApplied !== "NONE" || score.topDetractors.length > 0) && (
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

      {/* M-40. Tapping a zone lists what was checked there, then defers to the
          existing ExplainSheet so explanation copy lives in exactly one place. */}
      <DiagramZoneSheet
        shapeId={openShape}
        results={results ?? []}
        onClose={() => setOpenShape(null)}
        onSelectPoint={(r) => {
          setOpenShape(null);
          setExplain({
            point: {
              code: r.pointCode,
              label: r.label,
              templates: r.templates,
              recommendation: r.recommendation,
              thresholds: r.thresholds,
              unit: r.unit,
            } as ExplainTarget["point"],
            status: r.status ?? "NOT_APPLICABLE",
            measuredValue: r.measuredValue ?? undefined,
            photoUrl: r.photoUrls?.[0],
          });
        }}
      />
      <ExplainSheet target={explain} onClose={() => setExplain(null)} />
    </ScrollView>
  );
}
