import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { Reference } from "../../components/References";
import { Card } from "../../components/Card";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { FindingRow } from "../../components/FindingRow";
import { EmptyState } from "../../components/EmptyState";
import { Plate } from "../../components/Plate";
import { getInspectionDetail, type InspectionDetail, type InspectionResultDetail } from "./historyApi";
import { RepairDraftStore } from "../repairs/repairDraft";

const severity = { CRITICAL: 3, ATTENTION: 2, MONITOR: 1, GOOD: 0, NOT_APPLICABLE: 0 };
const manilaDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" });

export function InspectionDetailScreen({ vehicleId, inspectionId, vehiclePlateNo, onBack, onOpenRepair }: { vehicleId: string; inspectionId: string; vehiclePlateNo?: string; onBack?: () => void; onOpenRepair?(): void }) {
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [savedRepair, setSavedRepair] = useState(false);
  useEffect(() => {
    let mounted = true;
    setError(null); setDetail(null);
    getInspectionDetail(vehicleId, inspectionId).then((result) => {
      if (result.id !== inspectionId || result.vehicleId && result.vehicleId !== vehicleId) throw new Error("The report does not match this inspection and vehicle.");
      if (mounted) setDetail(result);
    }).catch((failure) => { if (mounted) setError(failure instanceof Error ? failure.message : "Could not load this inspection. It needs a connection."); });
    return () => { mounted = false; };
  }, [vehicleId, inspectionId, attempt]);
  useEffect(() => {
    let mounted = true;
    setSavedRepair(false);
    if (onOpenRepair) void new RepairDraftStore({ vehicleId, inspectionId }).read()
      .then((draft) => { if (mounted) setSavedRepair(!!draft); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [vehicleId, inspectionId, !!onOpenRepair]);
  const concerns = detail?.results.filter((r) => severity[r.status ?? "GOOD"] > 0).sort((a, b) => severity[b.status!] - severity[a.status!]) ?? [];
  const band = detail?.scope === "FULL" && detail.band ? t.vhsBands[detail.band] : null;
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Inspection report" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      {error ? <EmptyState tone="error" title="Unavailable" body={error} action={<Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>Try again</Button>} /> : !detail ? <EmptyState tone="loading" title="Loading inspection report…" /> : <>
        {vehiclePlateNo ? <Plate variant="plain">{vehiclePlateNo}</Plate> : null}
        <Card accent={band?.fill} style={{ gap: 8 }}>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{detail.submittedAt ? "Accepted inspection" : "Inspection in progress"}</Text>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>{detail.serviceName ?? detail.templateName ?? (detail.scope === "FULL" ? "Full inspection" : detail.scope === "FOCUSED" ? "Focused inspection" : "Legacy inspection")}</Text>
          {detail.scope === "FULL" && detail.score != null ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}><Text style={[t.text("h1"), { fontSize: 48, color: band?.text ?? t.colors.ink }]}>{detail.score}<Text style={[t.text("body"), { color: t.colors.inkMuted }]}> / 100</Text></Text>{band ? <Text style={[t.text("body", 600), { color: band.text }]}>{band.labelEn}</Text> : null}</View> : <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{detail.scope === "FOCUSED" ? "Focused findings cover only the checks below. Other systems are uninspected; this report does not replace the last full inspection score." : detail.scope === "FULL" ? "Full inspection score is pending." : "The scope of this legacy report is not confirmed. It does not establish whole-vehicle health."}</Text>}
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{detail.submittedAt ? manilaDate(detail.submittedAt) : "Not yet submitted"}{detail.odometerKm !== null ? ` · ${detail.odometerKm.toLocaleString("en-PH")} km` : ""}</Text>
        </Card>
        {concerns.length ? <View><Text style={[t.text("h2"), { color: t.colors.ink }]}>Findings</Text>{concerns.map((result) => <Point key={result.pointCode} result={result} />)}</View> : <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>No findings need attention.</Text>}
        <Disclosure title={`All points (${detail.results.length})`}>{detail.results.map((result) => <Point key={result.pointCode} result={result} />)}</Disclosure>
        {detail.observations?.length ? <View style={{ gap: 12 }}><Text style={[t.text("h2"), { color: t.colors.ink }]}>Additional findings</Text>{detail.observations.map((observation) => <View key={observation.id} style={{ gap: 8 }}><Text style={[t.text("body"), { color: t.colors.ink }]}>{observation.notes}</Text>{observation.photoUrls?.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{observation.photoUrls.map((uri) => <Image key={uri} source={{ uri }} accessibilityLabel="Additional finding photo" style={{ width: 120, height: 90, borderRadius: 8 }} resizeMode="cover" />)}</ScrollView> : null}</View>)}</View> : null}
        <Disclosure title="References"><Reference label="Inspection ID" value={detail.id} />{detail.appointmentId ? <Reference label="Booking ID" value={detail.appointmentId} /> : null}<Reference label="Vehicle ID" value={vehicleId} /></Disclosure>
      </>}
    </ScrollView>
    {(detail?.submittedAt || savedRepair) && onOpenRepair ? <ActionBar hint={detail ? "Keep the accepted inspection and subsequent repair work linked." : "Saved repair notes remain available. Reconnect before repair actions."}><Button onPress={onOpenRepair}>{detail ? "Open repair work" : "Open saved repair draft"}</Button></ActionBar> : null}
  </View>;
}

function Point({ result }: { result: InspectionResultDetail }) {
  return <View><FindingRow label={result.label} status={result.status ?? undefined} measurement={result.measuredValue !== null ? `${result.measuredValue}${result.unit ? ` ${result.unit}` : ""}` : undefined} notes={result.notes} photoCount={result.photoUrls?.length} />{result.photoUrls?.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>{result.photoUrls.map((uri) => <Image key={uri} source={{ uri }} accessibilityLabel={`Photo of ${result.label}`} style={{ width: 120, height: 90, borderRadius: 8 }} resizeMode="cover" />)}</ScrollView> : null}</View>;
}
