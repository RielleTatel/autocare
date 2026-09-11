import { ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { StatusChip } from "../../components/StatusChip";
import { FieldNav } from "../../components/FieldNav";
import type { LocalResult } from "../../shared/db/inspections.repo";
import type { CachedChecklist, Completeness } from "./draft";

const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

/** F-08 — the whole inspection at a glance before it leaves the device:
 *  every point with what was measured, what is still missing, and what the
 *  advisor will need to talk about. */
export function ReviewSubmitScreen({
  checklist, results, check, overall, isOffline, submitted, vehicle, onJumpToPoint, onSubmit, onBack, error,
}: {
  checklist: CachedChecklist;
  results: LocalResult[];
  check: Completeness;
  overall: { answered: number; total: number };
  isOffline?: boolean;
  submitted?: boolean;
  vehicle?: { plateNo: string; description?: string; odometerKm?: number };
  onJumpToPoint(code: string): void;
  onSubmit(): void;
  onBack?(): void;
  error?: string | null;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : Math.round((overall.answered / overall.total) * 100);
  const allPoints = checklist.categories.flatMap((c) => c.points);
  const labelFor = (code: string) => allPoints.find((p) => p.code === code)?.label ?? code;
  const resultFor = (code: string) => results.find((r) => r.pointCode === code);
  const adverse = results.filter((r) => r.status && ADVERSE.includes(r.status as PointStatus));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Review &amp; submit" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        {vehicle ? (
          <Card style={{ gap: t.spacing.xs }}>
            <Plate variant="plain">{vehicle.plateNo}</Plate>
            {vehicle.description || vehicle.odometerKm !== undefined ? (
              <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
                {[vehicle.description, vehicle.odometerKm !== undefined ? `${vehicle.odometerKm.toLocaleString("en-PH")} km` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Text
          accessibilityLabel={`Completion ${pct} percent`}
          style={{ ...t.text("h2"), color: check.complete ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }}
        >
          {pct}% complete ({overall.answered}/{overall.total})
        </Text>

        {allPoints.map((p) => {
          const r = resultFor(p.code);
          const status = r?.status as PointStatus | undefined;
          const threshold = p.thresholds?.good;
          return (
            <Card key={p.code} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm, minHeight: t.minTarget }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>{p.label}</Text>
                {r?.measuredValue !== undefined && threshold !== undefined ? (
                  <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>
                    {r.measuredValue} {p.unit} · good ≥ {threshold} {p.unit}
                  </Text>
                ) : null}
              </View>
              {status ? <StatusChip status={status} /> : <StatusPill tone="warn">NOT RECORDED</StatusPill>}
            </Card>
          );
        })}

        {(check.missingPoints.length > 0 || check.missingPhotos.length > 0) && (
          <Card accent={t.vhsBands.NEEDS_ATTENTION.fill} style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>
              {check.missingPoints.length + check.missingPhotos.length} still to record
            </Text>
            {check.missingPoints.map((code) => (
              <Text
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`Complete ${labelFor(code)}`}
                onPress={() => onJumpToPoint(code)}
                style={{ ...t.text("body"), color: t.colors.primary, minHeight: 44 }}
              >
                {labelFor(code)} — not answered
              </Text>
            ))}
            {check.missingPhotos.map((code) => (
              <Text
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`Add photo for ${labelFor(code)}`}
                onPress={() => onJumpToPoint(code)}
                style={{ ...t.text("body"), color: t.colors.danger, minHeight: 44 }}
              >
                {labelFor(code)} — photo required
              </Text>
            ))}
          </Card>
        )}

        {adverse.length > 0 && (
          <View style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Findings to discuss</Text>
            {adverse.map((r) => (
              <Card key={r.pointCode}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>
                  {labelFor(r.pointCode)} — {r.status === "CRITICAL" ? "Critical" : "Needs attention"}
                  {r.measuredValue !== undefined ? ` (${r.measuredValue})` : ""}
                </Text>
                {r.notes ? <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{r.notes}</Text> : null}
              </Card>
            ))}
          </View>
        )}

        {submitted ? (
          <Card>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Submitted</Text>
            {isOffline ? (
              <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Score will appear when synced.</Text>
            ) : null}
          </Card>
        ) : (
          <>
            <Button accessibilityLabel="Submit inspection" disabled={!check.complete} onPress={onSubmit}>
              Submit inspection
            </Button>
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
              Submits to the outbox — it will sync when you have signal.
            </Text>
            {error ? (
              <Text style={{ ...t.text("label"), color: t.colors.danger, textAlign: "center" }}>{error}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
