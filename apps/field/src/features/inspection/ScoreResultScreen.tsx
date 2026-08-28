import { ScrollView, Text, View } from "react-native";
import type { Band, PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { ScoreGauge } from "../../components/ScoreGauge";
import { StatusChip, statusColor } from "../../components/StatusChip";

export type FieldScore = {
  score: number;
  band: Band;
  overrideApplied: string;
  /** The pre-override average, shown so the mechanic can explain the cap. */
  averagedScore?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  topDetractors: Array<{
    label: string;
    status: PointStatus;
    recommendation: string;
    estimatedCostCentavos?: number;
  }>;
};

const peso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`;

/** F-09 — the gauge plus what to tell the customer. Shown once a submitted
 *  inspection syncs and returns its score. */
export function ScoreResultScreen({
  result, offline, onBackToTasks,
}: {
  result?: FieldScore;
  offline?: boolean;
  onBackToTasks?: () => void;
}) {
  const t = fieldTheme;

  if (!result) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
        <FieldNav title="Score result" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
          <Text style={{ ...t.text("h1"), color: t.colors.ink, textAlign: "center" }}>Inspection submitted</Text>
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.sm }}>
            {offline ? "Score will appear once this device syncs." : "Computing score…"}
          </Text>
        </View>
      </View>
    );
  }

  const capped = result.overrideApplied !== "NONE" && result.averagedScore !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Score result" />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.lg }}>
        <Card pad="lg" style={{ alignItems: "center", gap: t.spacing.sm }}>
          <ScoreGauge score={result.score} band={result.band} size={240} confidence={result.confidence} />
          {capped ? (
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
              Averaged {result.averagedScore} · capped at {Math.round(result.score)} by a safety-critical finding
            </Text>
          ) : null}
        </Card>

        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>What to tell the customer</Text>

        {result.overrideApplied !== "NONE" && (
          <Card accent={t.colors.danger}>
            <Text style={{ ...t.text("body"), color: t.colors.danger }}>
              A safety-critical item {result.overrideApplied === "SAFETY_CRITICAL" ? "is in unsafe condition" : "needs attention"} — explain the score is capped until it is fixed.
            </Text>
          </Card>
        )}

        {result.topDetractors.map((d, i) => (
          <Card key={i} accent={statusColor(d.status)} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.text("body"), color: t.colors.ink }}>{d.label}</Text>
              <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{d.recommendation}</Text>
              {d.estimatedCostCentavos !== undefined ? (
                <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>est. {peso(d.estimatedCostCentavos)}</Text>
              ) : null}
            </View>
            <StatusChip status={d.status} />
          </Card>
        ))}

        {onBackToTasks ? (
          <Button variant="secondary" onPress={onBackToTasks}>Back to today's tasks</Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
