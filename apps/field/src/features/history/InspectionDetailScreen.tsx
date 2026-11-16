import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { Reference } from "../../components/References";
import { Card } from "../../components/Card";
import { FieldNav } from "../../components/FieldNav";
import { Disclosure, workContent } from "../../components/FieldLayout";
import { FindingRow } from "../../components/FindingRow";
import { EmptyState } from "../../components/EmptyState";
import { Plate } from "../../components/Plate";
import { getInspectionDetail, type InspectionDetail, type InspectionResultDetail } from "./historyApi";

const severity = { CRITICAL: 3, ATTENTION: 2, MONITOR: 1, GOOD: 0, NOT_APPLICABLE: 0 };
const manilaDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" });

export function InspectionDetailScreen({ vehicleId, inspectionId, vehiclePlateNo, onBack }: { vehicleId: string; inspectionId: string; vehiclePlateNo?: string; onBack?: () => void }) {
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError(null); setDetail(null);
    getInspectionDetail(vehicleId, inspectionId).then((result) => { if (mounted) setDetail(result); }).catch(() => { if (mounted) setError("Could not load this inspection. It needs a connection."); });
    return () => { mounted = false; };
  }, [vehicleId, inspectionId, attempt]);
  const concerns = detail?.results.filter((r) => severity[r.status ?? "GOOD"] > 0).sort((a, b) => severity[b.status!] - severity[a.status!]) ?? [];
  const band = detail?.band ? t.vhsBands[detail.band] : null;
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Inspection report" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      {error ? <EmptyState tone="error" title="Unavailable" body={error} action={<Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>Try again</Button>} /> : !detail ? <EmptyState tone="loading" title="Loading inspection report…" /> : <>
        {vehiclePlateNo ? <Plate variant="plain">{vehiclePlateNo}</Plate> : null}
        <Card accent={band?.fill} style={{ gap: 8 }}>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{detail.submittedAt ? "Accepted inspection" : "Inspection in progress"}</Text>
          {detail.score != null ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}><Text style={[t.text("h1"), { fontSize: 48, color: band?.text ?? t.colors.ink }]}>{detail.score}<Text style={[t.text("body"), { color: t.colors.inkMuted }]}> / 100</Text></Text>{band ? <Text style={[t.text("body", 600), { color: band.text }]}>{band.labelEn}</Text> : null}</View> : detail.submittedAt ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Report accepted. Health score calculation is pending.</Text> : null}
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{detail.submittedAt ? manilaDate(detail.submittedAt) : "Not yet submitted"}{detail.odometerKm !== null ? ` · ${detail.odometerKm.toLocaleString("en-PH")} km` : ""}</Text>
        </Card>
        {concerns.length ? <View><Text style={[t.text("h2"), { color: t.colors.ink }]}>Findings</Text>{concerns.map((result) => <Point key={result.pointCode} result={result} />)}</View> : <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>No findings need attention.</Text>}
        <Disclosure title={`All points (${detail.results.length})`}>{detail.results.map((result) => <Point key={result.pointCode} result={result} />)}</Disclosure>
        <Disclosure title="References"><Reference label="Inspection ID" value={detail.id} />{detail.appointmentId ? <Reference label="Booking ID" value={detail.appointmentId} /> : null}<Reference label="Vehicle ID" value={vehicleId} /></Disclosure>
      </>}
    </ScrollView>
  </View>;
}

function Point({ result }: { result: InspectionResultDetail }) {
  return <View><FindingRow label={result.label} status={result.status ?? undefined} measurement={result.measuredValue !== null ? `${result.measuredValue}${result.unit ? ` ${result.unit}` : ""}` : undefined} notes={result.notes} photoCount={result.photoUrls?.length} />{result.photoUrls?.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>{result.photoUrls.map((uri) => <Image key={uri} source={{ uri }} accessibilityLabel={`Photo of ${result.label}`} style={{ width: 120, height: 90, borderRadius: 8 }} resizeMode="cover" />)}</ScrollView> : null}</View>;
}
