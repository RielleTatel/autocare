import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { ConfigPoint } from "@autocare/scoring";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { FindingRow } from "../../components/FindingRow";
import { ProgressBar } from "../../components/ProgressBar";
import type { LocalResult } from "../../shared/db/inspections.repo";
import { resolveStatus, type CachedChecklist, type Completeness } from "./draft";

const severity = { CRITICAL: 3, ATTENTION: 2, MONITOR: 1, GOOD: 0, NOT_APPLICABLE: 0 };
export function ReviewSubmitScreen({ checklist, results, check, overall, isOffline, submitted, vehicle, onJumpToPoint, onSubmit, onBack, error }: {
  checklist: CachedChecklist; results: LocalResult[]; check: Completeness;
  overall: { answered: number; total: number }; isOffline?: boolean; submitted?: boolean;
  vehicle?: { plateNo: string; description?: string; odometerKm?: number };
  onJumpToPoint(code: string): void; onSubmit(): void | Promise<void>; onBack?(): void; error?: string | null;
}) {
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true; setSending(true); setSubmitError(null);
    try { await onSubmit(); }
    catch (e) { setSubmitError(e instanceof Error ? e.message : "Could not save this submission. Try again."); }
    finally { submitting.current = false; setSending(false); }
  };
  const pct = overall.total === 0 ? 0 : Math.round((overall.answered / overall.total) * 100);
  const allPoints = checklist.categories.flatMap((c) => c.points);
  const byCode = new Map(results.map((result) => [result.pointCode, result]));
  const missing = allPoints.filter((point) => check.missingPoints.includes(point.code));
  const concerns = allPoints.filter((point) => severity[resolveStatus(point, byCode.get(point.code)) ?? "GOOD"] > 0)
    .sort((a, b) => severity[resolveStatus(b, byCode.get(b.code))!] - severity[resolveStatus(a, byCode.get(a.code))!]);
  const row = (point: ConfigPoint, missing = false) => {
    const result = byCode.get(point.code);
    return <FindingRow key={point.code} label={point.label} status={resolveStatus(point, result)}
      measurement={result?.measuredValue !== undefined ? `${result.measuredValue} ${point.unit ?? ""}${point.thresholds ? ` · good ${point.thresholds.direction === "HIGHER_BETTER" ? "≥" : "≤"} ${point.thresholds.good} ${point.unit ?? ""}` : ""}` : undefined}
      notes={result?.notes} photoCount={result?.photoUris.length} onPress={submitted ? undefined : () => onJumpToPoint(point.code)} accessibilityLabel={`${missing ? "Complete" : "Edit"} ${point.label}`} />;
  };
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Review & submit" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      {vehicle ? <View style={{ gap: 6 }}><Plate variant="plain">{vehicle.plateNo}</Plate>{vehicle.description || vehicle.odometerKm !== undefined ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{[vehicle.description, vehicle.odometerKm !== undefined ? `${vehicle.odometerKm.toLocaleString("en-PH")} km` : null].filter(Boolean).join(" · ")}</Text> : null}</View> : null}
      <View style={{ gap: 8 }}><Text accessibilityLabel={`Completion ${pct} percent`} style={[t.text("h2"), { color: check.complete ? t.colors.success : t.colors.ink }]}>{pct}% complete ({overall.answered}/{overall.total})</Text><ProgressBar answered={overall.answered} total={overall.total} /></View>
      {missing.length ? <View><Text style={[t.text("h2"), { color: t.colors.ink }]}>{missing.length} still to record</Text>{missing.map((point) => row(point, true))}</View> : null}
      {concerns.length ? <View><Text style={[t.text("h2"), { color: t.colors.ink }]}>Findings to discuss ({concerns.length})</Text>{concerns.map((point) => row(point))}</View> : check.complete ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>All points recorded. No findings need attention.</Text> : null}
      <Disclosure title={`All results (${allPoints.length})`}>{checklist.categories.map((category) => <View key={category.code}><Text style={[t.text("body", 600), { color: t.colors.ink }]}>{category.label}</Text>{category.points.map((point) => row(point))}</View>)}</Disclosure>
      {submitted ? <View style={{ gap: 8 }}><Text style={[t.text("h2"), { color: t.colors.ink }]}>Pending sync</Text><Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Saved on this device. The inspection is complete after the server accepts it.</Text>{isOffline ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Score will appear when synced.</Text> : null}</View> : null}
      {error || submitError ? <Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{error ?? submitError}</Text> : null}
    </ScrollView>
    {!submitted ? <ActionBar hint={missing.length ? `Record ${missing.length} remaining ${missing.length === 1 ? "answer" : "answers"} before submitting. Photos are optional.` : "Saves on this device and syncs when connected. Completion follows server acceptance."}><Button accessibilityLabel="Submit inspection" disabled={!check.complete || sending} onPress={() => { void submit(); }}>{sending ? "Saving…" : "Submit inspection"}</Button></ActionBar> : null}
  </View>;
}
