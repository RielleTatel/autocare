import { useEffect, useState, type ReactNode } from "react";
import { Image, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { StatusPill } from "../../components/StatusPill";
import { theme } from "../../theme";
import type { HealthScore } from "../health-score/healthScoreApi";
import { effectiveStatus, statusLabel } from "../health-score/zoneStatus";
import { statusColor } from "../health-score/statusColor";
import { peso } from "../work-orders/workOrderApi";
import { documentState, repairStatusLabel, scopeLabel, serviceDate, type InspectionSummary, type RepairSummary, type ScopedInspectionDetail, type ServiceDocument } from "./serviceHistoryApi";

export function HistoryPage({ title, onBack, onRefresh, loading, error, children }: {
  title: string; onBack: () => void; onRefresh: () => void; loading: boolean; error: string | null; children?: ReactNode;
}) {
  return <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }} contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}>
    <Button variant="ghost" icon="chevron-left" onPress={onBack} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}>Back</Button>
    <Text accessibilityRole="header" style={[theme.text("h1"), { color: theme.colors.ink }]}>{title}</Text>
    {error ? <EmptyState tone="error" title="Could not load this record" body={error} action={<Button onPress={onRefresh}>Try again</Button>} />
      : loading ? <EmptyState tone="loading" title="Loading your records…" /> : children}
  </ScrollView>;
}

function Body({ children }: { children: ReactNode }) {
  return <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>{children}</Text>;
}

function RepairCard({ repair, onPress, showEstimate = true }: { repair: RepairSummary; onPress?: () => void; showEstimate?: boolean }) {
  return <Card testID={`repair-${repair.id}`} onPress={onPress} style={{ gap: theme.spacing.xs }}>
    <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{repair.number}</Text>
    <StatusPill tone={repair.status === "PAID" || repair.status === "NO_CHARGE" ? "success" : "neutral"}>{repairStatusLabel(repair.status)}</StatusPill>
    <Body>{repair.repairNotes}</Body>
    {showEstimate && <Body>Additional repair estimate · {peso(repair.estimatedTotalCentavos)}</Body>}
    {repair.stoppedAt && <Body>Stopped {serviceDate(repair.stoppedAt)}. Completed work is under review.</Body>}
    {onPress && <Text style={[theme.text("label"), { color: theme.colors.primary }]}>View repair progress →</Text>}
  </Card>;
}

export function InspectionHistoryScreen({ inspections, repairs, fullScore, onOpenReport, onOpenRepair, onOpenHealth, onOpenBill }: {
  inspections: InspectionSummary[]; repairs: RepairSummary[]; fullScore: HealthScore | null;
  onOpenReport: (id: string) => void; onOpenRepair: (id: string) => void; onOpenHealth: () => void; onOpenBill: (id: string) => void;
}) {
  return <>
    <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Last full vehicle score</Text>
      {fullScore ? <>
        <Text style={[theme.text("h1"), { color: theme.vhsBands[fullScore.band].text }]}>{fullScore.score} / 100</Text>
        <Body>{fullScore.inspectedAt ? `Inspected ${serviceDate(fullScore.inspectedAt)}` : "Inspection date unavailable"}{fullScore.isStale ? " · May be out of date" : ""}</Body>
        <Button variant="secondary" onPress={onOpenHealth}>View full health report</Button>
      </> : <Body>No full inspection yet.</Body>}
      <Body>Focused inspections cover the checks shown in each report. They do not replace the full vehicle score.</Body>
    </Card>
    <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Inspection reports</Text>
    {inspections.length === 0 && <EmptyState title="No inspection reports yet" body="Accepted reports will appear here after your service." />}
    {[...inspections].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")).map(report => <Card key={report.id} testID={`inspection-${report.id}`} style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{report.serviceName ?? report.templateName ?? scopeLabel(report.scope)}</Text>
      <StatusPill>{scopeLabel(report.scope)}</StatusPill>
      <Body>{report.submittedAt ? serviceDate(report.submittedAt) : "Inspection not submitted"}{report.odometerKm != null ? ` · ${report.odometerKm.toLocaleString()} km` : ""}</Body>
      {report.scope === "FULL" && report.score != null && <Body>Full inspection score · {report.score} / 100</Body>}
      <Button variant="secondary" onPress={() => onOpenReport(report.id)}>View original report</Button>
      {report.invoiceId && <Button variant="ghost" onPress={() => onOpenBill(report.invoiceId!)}>View final service document</Button>}
    </Card>)}
    <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Repairs</Text>
    {repairs.length === 0 && <Body>No linked repairs.</Body>}
    {[...repairs].sort((a, b) => (b.updatedAt ?? b.openedAt).localeCompare(a.updatedAt ?? a.openedAt)).map(repair => <RepairCard key={repair.id} repair={repair} onPress={() => onOpenRepair(repair.id)} />)}
  </>;
}

export function InspectionReportScreen({ report, repairs, onOpenRepair, onOpenBill }: {
  report: ScopedInspectionDetail; repairs: RepairSummary[]; onOpenRepair: (id: string) => void; onOpenBill: (id: string) => void;
}) {
  return <>
    <Card style={{ gap: theme.spacing.sm }}>
      <StatusPill>{scopeLabel(report.scope)}</StatusPill>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{report.serviceName ?? report.templateName ?? "Original inspection"}</Text>
      <Body>{report.submittedAt ? `Inspected ${serviceDate(report.submittedAt)}` : "Inspection not submitted"}{report.odometerKm != null ? ` · ${report.odometerKm.toLocaleString()} km` : ""}</Body>
      {report.scope === "FULL" && report.score != null && <Body>Original full inspection score · {report.score} / 100</Body>}
      {report.scope === "FOCUSED" && <Body>Only the checks below were inspected. Other systems were not inspected during this service; this report does not assign a full vehicle score.</Body>}
      {report.scope !== "FULL" && report.scope !== "FOCUSED" && <Body>The scope of this older inspection cannot be verified. It is not presented as a full vehicle assessment.</Body>}
      <Body>These are the original findings. Subsequent repair progress is recorded separately.</Body>
    </Card>
    <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Checks recorded</Text>
    {report.results.length === 0 && <Body>No component results were recorded.</Body>}
    {report.results.map(result => {
      const status = effectiveStatus(result);
      return <Card key={result.pointCode} accent={statusColor(status)} style={{ gap: theme.spacing.xs }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{result.label}</Text>
        <Body>{statusLabel(status)}{result.measuredValue != null ? ` · ${result.measuredValue}${result.unit ? ` ${result.unit}` : ""}` : ""}</Body>
        {result.notes && <Body>{result.notes}</Body>}
        {result.recommendation && status && status !== "GOOD" && status !== "NOT_APPLICABLE" && <Body>{result.recommendation}</Body>}
        {result.photoUrls.map((uri, index) => <Image key={`${uri}:${index}`} source={{ uri }} accessibilityLabel={`${result.label} inspection photo ${index + 1}`} style={{ width: "100%", height: 210, borderRadius: theme.radii.sm }} resizeMode="contain" />)}
      </Card>;
    })}
    {(report.observations?.length ?? 0) > 0 && <>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Additional observations</Text>
      <Body>Observed outside the booked checks. These do not expand the inspection scope.</Body>
      {report.observations!.map(observation => <Card key={observation.id} style={{ gap: theme.spacing.sm }}>
        <Body>{observation.notes}</Body>
        {observation.photoUrls.map((uri, index) => <Image key={`${uri}:${index}`} source={{ uri }} accessibilityLabel={`Additional observation photo ${index + 1}`} style={{ width: "100%", height: 210, borderRadius: theme.radii.sm }} resizeMode="contain" />)}
      </Card>)}
    </>}
    {report.invoiceId && <Button onPress={() => onOpenBill(report.invoiceId!)}>View final service document</Button>}
    {repairs.length > 0 && <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Subsequent repairs</Text>}
    {repairs.map(repair => <RepairCard key={repair.id} repair={repair} onPress={() => onOpenRepair(repair.id)} />)}
  </>;
}

export function RepairProgressScreen({ repair, onOpenReport, onOpenBill }: { repair: RepairSummary; onOpenReport: () => void; onOpenBill: (id: string) => void }) {
  const stopped = !!repair.stoppedAt || repair.status === "STOPPED";
  return <>
    <RepairCard repair={repair} showEstimate={false} />
    <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Additional repair estimate</Text>
      <Text style={[theme.text("h1"), { color: theme.colors.ink }]}>{peso(repair.estimatedTotalCentavos)}</Text>
      <Body>This estimate covers additional repairs and excludes the original booked service. It is not an issued bill or a payment request.</Body>
    </Card>
    {repair.returnScheduledStart && <Card><Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Return visit</Text><Body>{serviceDate(repair.returnScheduledStart)}</Body></Card>}
    {(repair.completedAt || repair.recheckedAt || repair.completionNotes || stopped) && <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{stopped ? "Repair stopped" : "Work completed"}</Text>
      {stopped ? <>
        {repair.stoppedAt && <Body>Stopped {serviceDate(repair.stoppedAt)}</Body>}
        {repair.stopReason && <Body>{repair.stopReason}</Body>}
        {repair.completedWorkNotes && <Body>Work performed: {repair.completedWorkNotes}</Body>}
        <Body>Unfinished findings remain unresolved.</Body>
      </> : <>
        {repair.completedAt && <Body>Completed {serviceDate(repair.completedAt)}</Body>}
        {repair.recheckedAt && <Body>Repairs rechecked {serviceDate(repair.recheckedAt)}</Body>}
      </>}
      {repair.completionNotes && <Body>{repair.completionNotes}</Body>}
    </Card>}
    {repair.invoiceId ? <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Final billing</Text>
      <Body>The issued document shows the verified service and repair charges and current cash settlement.</Body>
      <Button onPress={() => onOpenBill(repair.invoiceId!)}>View final bill / receipt</Button>
    </Card> : <Card style={{ gap: theme.spacing.sm }}>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Final bill not issued</Text>
      <Body>{repair.status === "AWAITING_ADMIN_REVIEW" || stopped ? "Admin will verify the work and final charges. Completion does not mean the job has been paid." : "Final charges will appear after admin review."}</Body>
    </Card>}
    <Button variant="secondary" onPress={onOpenReport}>View original inspection</Button>
  </>;
}

export function ServiceDocumentScreen({ document, onOpenDocument }: { document: ServiceDocument; onOpenDocument: () => Promise<void> }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setError(null); setOpening(false); }, [document.id]);
  const state = documentState(document);
  const noCharge = state === "No charge";
  const paid = state === "Paid";
  const cashReceipt = paid && document.payment?.method === "CASH" && document.payment.status === "SUCCEEDED";
  const open = async () => {
    setOpening(true); setError(null);
    try { await onOpenDocument(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not open this document. Try again."); }
    finally { setOpening(false); }
  };
  return <>
    <Card style={{ gap: theme.spacing.sm }}>
      <StatusPill tone={noCharge || paid ? "success" : "neutral"}>{state}</StatusPill>
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{document.number}</Text>
      <Body>Issued {serviceDate(document.issuedAt)}</Body>
      <Body>{noCharge ? "This finalized job has no amount due. No cash payment was recorded." : cashReceipt ? "Cash payment has been recorded. Your receipt is available below." : paid ? "This bill is settled." : "Pay the issued total in cash at the workshop counter."}</Body>
    </Card>
    <Card style={{ gap: theme.spacing.md }}>
      {document.items.map(item => <View key={item.id} style={{ flexDirection: "row", gap: theme.spacing.sm, justifyContent: "space-between" }}>
        <Text style={[theme.text("body"), { color: theme.colors.ink, flex: 1 }]}>{item.description}{item.qty > 1 ? ` ×${item.qty}` : ""}</Text>
        <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{peso(item.unitPriceCentavos * item.qty + item.taxCentavos)}</Text>
      </View>)}
      <View style={{ borderTopColor: theme.colors.line, borderTopWidth: 1, paddingTop: theme.spacing.md, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>{noCharge ? "No charge" : "Final total"}</Text>
        <Text testID="service-document-total" style={[theme.text("h2"), { color: theme.colors.ink }]}>{peso(document.totalCentavos)}</Text>
      </View>
      {cashReceipt && document.payment?.tenderedCentavos != null && <Body>Cash received · {peso(document.payment.tenderedCentavos)}</Body>}
      {cashReceipt && document.payment?.changeCentavos != null && <Body>Change · {peso(document.payment.changeCentavos)}</Body>}
    </Card>
    {error && <Text accessibilityRole="alert" style={[theme.text("body"), { color: theme.colors.danger }]}>{error}</Text>}
    <Button disabled={opening} onPress={() => void open()}>{opening ? "Opening…" : noCharge ? "Open No charge document" : cashReceipt ? "Open cash receipt" : "Open final bill"}</Button>
  </>;
}
