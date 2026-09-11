import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { FieldNav } from "../../components/FieldNav";
import { StatusChip } from "../../components/StatusChip";
import { EmptyState } from "../../components/EmptyState";
import { getInspectionDetail, type InspectionDetail, type InspectionResultDetail } from "./historyApi";

const ADVERSE = new Set(["ATTENTION", "CRITICAL"]);

const manilaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" });

/** What was actually found last time, point by point. Adverse findings first —
 *  a technician opening history is looking for what was wrong, not reading all
 *  50 points in checklist order. */
export function InspectionDetailScreen({
  vehicleId,
  inspectionId,
  onBack,
}: {
  vehicleId: string;
  inspectionId: string;
  onBack?: () => void;
}) {
  const t = fieldTheme;
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getInspectionDetail(vehicleId, inspectionId)
      .then((d) => { if (mounted) setDetail(d); })
      .catch(() => { if (mounted) setError("Could not load this inspection. It needs a connection."); });
    return () => { mounted = false; };
  }, [vehicleId, inspectionId]);

  const body = () => {
    if (error) return <EmptyState tone="error" title="Unavailable" body={error} />;
    if (!detail) return null;

    const adverse = detail.results.filter((r) => r.status && ADVERSE.has(r.status));
    const rest = detail.results.filter((r) => !(r.status && ADVERSE.has(r.status)));

    return (
      <>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
          {detail.submittedAt ? manilaDate(detail.submittedAt) : "Not yet submitted"}
          {detail.odometerKm !== null ? ` · ${detail.odometerKm.toLocaleString("en-PH")} km` : ""}
        </Text>

        {adverse.length > 0 && (
          <>
            <Text style={{ ...t.text("h2"), color: t.colors.danger }}>Findings</Text>
            {adverse.map((r) => <Point key={r.pointCode} r={r} />)}
          </>
        )}

        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>All points</Text>
        {rest.map((r) => <Point key={r.pointCode} r={r} />)}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Past inspection" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>{body()}</ScrollView>
    </View>
  );
}

function Point({ r }: { r: InspectionResultDetail }) {
  const t = fieldTheme;
  return (
    <Card style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
        <Text style={{ ...t.text("body"), color: t.colors.ink, flex: 1 }}>{r.label}</Text>
        {r.status ? <StatusChip status={r.status} /> : null}
      </View>
      {r.measuredValue !== null ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
          {r.measuredValue}{r.unit ? ` ${r.unit}` : ""}
        </Text>
      ) : null}
      {r.notes ? <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{r.notes}</Text> : null}
    </Card>
  );
}
