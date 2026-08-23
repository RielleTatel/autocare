import { Pressable, ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import type { LocalResult } from "../../shared/db/inspections.repo";
import type { CachedChecklist, Completeness } from "./draft";

const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

/** F-08 — completion %, missing list (tap jumps to point), adverse summary,
 *  submit disabled until complete. On submit the caller enqueues + locks. */
export function ReviewSubmitScreen({
  checklist, results, check, overall, isOffline, submitted, onJumpToPoint, onSubmit,
}: {
  checklist: CachedChecklist;
  results: LocalResult[];
  check: Completeness;
  overall: { answered: number; total: number };
  isOffline?: boolean;
  submitted?: boolean;
  onJumpToPoint(code: string): void;
  onSubmit(): void;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : Math.round((overall.answered / overall.total) * 100);
  const labelFor = (code: string) =>
    checklist.categories.flatMap((c) => c.points).find((p) => p.code === code)?.label ?? code;
  const adverse = results.filter((r) => r.status && ADVERSE.includes(r.status as PointStatus));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>Review inspection</Text>
      <Text accessibilityLabel={`Completion ${pct} percent`} style={[t.text("h2"), { color: check.complete ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }]}>
        {pct}% complete ({overall.answered}/{overall.total})
      </Text>

      {(check.missingPoints.length > 0 || check.missingPhotos.length > 0) && (
        <View style={{ gap: t.spacing.xs }}>
          <Text style={[t.text("h2"), { color: t.colors.danger }]}>Still needed</Text>
          {check.missingPoints.map((code) => (
            <Pressable key={code} accessibilityRole="button" accessibilityLabel={`Complete ${labelFor(code)}`} onPress={() => onJumpToPoint(code)}
              style={{ minHeight: t.minTarget, justifyContent: "center", backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, paddingHorizontal: t.spacing.md }}>
              <Text style={[t.text("body"), { color: t.colors.ink }]}>{labelFor(code)} — not answered</Text>
            </Pressable>
          ))}
          {check.missingPhotos.map((code) => (
            <Pressable key={code} accessibilityRole="button" accessibilityLabel={`Add photo for ${labelFor(code)}`} onPress={() => onJumpToPoint(code)}
              style={{ minHeight: t.minTarget, justifyContent: "center", backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.danger, paddingHorizontal: t.spacing.md }}>
              <Text style={[t.text("body"), { color: t.colors.danger }]}>{labelFor(code)} — photo required</Text>
            </Pressable>
          ))}
        </View>
      )}

      {adverse.length > 0 && (
        <View style={{ gap: t.spacing.xs }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>Findings to discuss</Text>
          {adverse.map((r) => (
            <View key={r.pointCode} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}>
              <Text style={[t.text("body"), { color: t.colors.ink }]}>
                {labelFor(r.pointCode)} — {r.status === "CRITICAL" ? "Critical" : "Needs attention"}
                {r.measuredValue !== undefined ? ` (${r.measuredValue})` : ""}
              </Text>
              {r.notes && <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{r.notes}</Text>}
            </View>
          ))}
        </View>
      )}

      {submitted ? (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>Submitted ✓</Text>
          {isOffline && (
            <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
              Score will appear when synced.
            </Text>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit inspection"
          accessibilityState={{ disabled: !check.complete }}
          disabled={!check.complete}
          onPress={onSubmit}
          style={{
            minHeight: t.minTarget, borderRadius: t.radii.md,
            backgroundColor: check.complete ? t.colors.primary : t.colors.line,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Submit inspection</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
