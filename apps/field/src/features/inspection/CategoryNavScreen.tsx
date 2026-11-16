import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { Reference } from "../../components/References";
import { Icon } from "../../components/Icon";
import { ProgressBar } from "../../components/ProgressBar";
import { StatusChip } from "../../components/StatusChip";
import type { LocalResult } from "../../shared/db/inspections.repo";
import { manilaSchedule } from "../tasks/tasksApi";
import { resolveStatus, type CachedChecklist, type CategoryProgress } from "./draft";

/** Category checklist: expand a system, scan its findings, open any point. */
export function CategoryNavScreen({ perCategory, overall, onOpenCategory, onOpenPoint, onReview, onBack, checklist, results = [], appointmentId, scheduledStart }: {
  perCategory: CategoryProgress[];
  overall: { answered: number; total: number };
  onOpenCategory(code: string): void;
  onOpenPoint?(code: string): void;
  onReview(): void;
  onBack?(): void;
  checklist?: CachedChecklist;
  results?: LocalResult[];
  appointmentId?: string;
  scheduledStart?: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(() => (perCategory.find((cat) => cat.answered < cat.total) ?? perCategory[0])?.code ?? null);
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Inspection" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      <View style={{ gap: 8 }}><Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{overall.answered} of {overall.total} points recorded</Text><ProgressBar answered={overall.answered} total={overall.total} /></View>
      <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Open a category, then choose any point to record or edit a finding.</Text>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.sm, borderWidth: 1, borderColor: t.colors.line, overflow: "hidden" }}>
        {perCategory.map((cat, index) => {
          const points = checklist?.categories.find((c) => c.code === cat.code)?.points;
          const open = expanded === cat.code && Boolean(points);
          return <View key={cat.code} style={{ borderTopWidth: index ? 1 : 0, borderColor: t.colors.line }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${cat.label}: ${cat.answered} of ${cat.total} done`} accessibilityState={points ? { expanded: open } : undefined} onPress={() => points ? setExpanded(open ? null : cat.code) : onOpenCategory(cat.code)} style={{ minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: open ? t.colors.surfaceSoft : t.colors.surface }}>
              <View style={{ flex: 1, gap: 3 }}><Text style={[t.text("body", 600), { color: t.colors.ink }]}>{cat.label}</Text>{cat.labelFil ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{cat.labelFil}</Text> : null}</View>
              <Text style={[t.text("label", 600), { color: cat.answered === cat.total ? t.colors.success : t.colors.inkMuted }]}>{cat.answered}/{cat.total}</Text><Icon name={open ? "chevron-down" : "chevron-right"} size={20} color={t.colors.inkMuted} />
            </Pressable>
            {open ? points?.map((point) => {
              const result = results.find((r) => r.pointCode === point.code);
              const status = resolveStatus(point, result);
              return <Pressable key={point.code} accessibilityRole="button" accessibilityLabel={`Edit ${point.label}`} onPress={() => onOpenPoint?.(point.code)} style={({ pressed }) => ({ minHeight: t.minTarget, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderColor: t.colors.lineSoft, backgroundColor: pressed ? t.colors.chassis : t.colors.surface })}>
                <View style={{ flex: 1, gap: 4 }}><Text style={[t.text("body"), { color: t.colors.ink }]}>{point.label}</Text>{result?.measuredValue !== undefined ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{result.measuredValue} {point.unit}</Text> : null}{result?.notes ? <Text numberOfLines={1} style={[t.text("label"), { color: t.colors.inkMuted }]}>{result.notes}</Text> : null}</View>
                {status ? <StatusChip status={status} /> : <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Not recorded</Text>}<Icon name="chevron-right" size={16} color={t.colors.inkMuted} />
              </Pressable>;
            }) : null}
          </View>;
        })}
      </View>
      {appointmentId ? <Disclosure title="Booking references">{scheduledStart ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Scheduled {manilaSchedule(scheduledStart)} · Philippine time</Text> : null}<Reference label="Booking ID" value={appointmentId} /></Disclosure> : null}
    </ScrollView>
    <ActionBar><Button icon="clipboard-check" onPress={onReview}>Review &amp; submit</Button></ActionBar>
  </View>;
}
