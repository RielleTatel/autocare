import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { deriveStatus } from "@autocare/scoring";
import type { ConfigPoint, PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import type { LocalResult } from "../../shared/db/inspections.repo";

const STATUSES: Array<Exclude<PointStatus, never>> = ["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"];
const STATUS_LABELS: Record<PointStatus, string> = {
  GOOD: "Good", MONITOR: "Monitor", ATTENTION: "Attention", CRITICAL: "Critical", NOT_APPLICABLE: "N/A",
};
const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

function statusColor(s: PointStatus): string {
  const t = fieldTheme;
  switch (s) {
    case "GOOD": return t.vhsBands.EXCELLENT.fill;
    case "MONITOR": return t.vhsBands.FAIR.fill;
    case "ATTENTION": return t.vhsBands.NEEDS_ATTENTION.fill;
    case "CRITICAL": return t.vhsBands.CRITICAL.fill;
    case "NOT_APPLICABLE": return t.colors.inkMuted;
  }
}

export interface PointEntryProps {
  point: ConfigPoint;
  initial?: LocalResult;
  onSave(result: LocalResult): void;
  onAddPhoto(): void;
  onNext(): void;
  /** Injected so tests can observe haptics without native modules. */
  onAdverseHaptic?: () => void;
}

/** F-06 — one point per screen: giant chips (≥56dp), numeric pad + live derived
 *  chip for measured points, blocking photo affordance on adverse findings. */
export function PointEntryScreen({ point, initial, onSave, onAddPhoto, onNext, onAdverseHaptic }: PointEntryProps) {
  const t = fieldTheme;
  const [status, setStatus] = useState<PointStatus | undefined>(initial?.status as PointStatus | undefined);
  const [value, setValue] = useState<string>(initial?.measuredValue?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const photoUris = initial?.photoUris ?? [];

  const derived = useMemo<PointStatus | undefined>(() => {
    if (point.inputType !== "MEASURED" || !point.thresholds) return undefined;
    const v = Number(value);
    if (value.trim() === "" || Number.isNaN(v)) return undefined;
    return deriveStatus(v, point.thresholds);
  }, [point, value]);

  const effective = point.inputType === "MEASURED" ? (derived ?? status) : status;
  const needsPhoto = Boolean(point.requiresPhotoOnAdverse && effective && ADVERSE.includes(effective) && photoUris.length === 0);

  const save = () => {
    onSave({
      pointCode: point.code,
      status: effective,
      measuredValue: point.inputType === "MEASURED" && value.trim() !== "" ? Number(value) : undefined,
      notes: notes.trim() === "" ? undefined : notes,
      photoUris,
    });
  };

  const pick = (s: PointStatus) => {
    setStatus(s);
    if (ADVERSE.includes(s)) onAdverseHaptic?.();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>{point.label}</Text>
      {point.labelFil && <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{point.labelFil}</Text>}

      {point.inputType === "MEASURED" && (
        <View style={{ gap: t.spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <TextInput
              accessibilityLabel={`${point.label} measured value`}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholder="0.0"
              style={{
                flex: 1, minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md,
                backgroundColor: t.colors.surface, paddingHorizontal: t.spacing.md, fontSize: 28, color: t.colors.ink,
              }}
            />
            <Text style={[t.text("h2"), { color: t.colors.inkMuted }]}>{point.unit}</Text>
          </View>
          {derived && (
            <View
              testID="derived-status-chip"
              style={{ alignSelf: "flex-start", backgroundColor: statusColor(derived), borderRadius: t.radii.pill, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs }}
            >
              <Text style={[t.text("label"), { color: "#FFFFFF" }]}>{STATUS_LABELS[derived]}</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ gap: t.spacing.sm }}>
        {STATUSES.map((s) => {
          const selected = effective === s;
          const disabled = point.inputType === "MEASURED" && derived !== undefined && derived !== s;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={STATUS_LABELS[s]}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => pick(s)}
              style={{
                minHeight: t.minTarget,
                borderRadius: t.radii.md,
                borderWidth: selected ? 0 : 1,
                borderColor: t.colors.line,
                backgroundColor: selected ? statusColor(s) : t.colors.surface,
                alignItems: "center",
                justifyContent: "center",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Text style={[t.text("h2"), { color: selected ? "#FFFFFF" : t.colors.ink }]}>{STATUS_LABELS[s]}</Text>
            </Pressable>
          );
        })}
      </View>

      {needsPhoto && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo (required)"
          onPress={onAddPhoto}
          style={{ minHeight: t.minTarget, borderRadius: t.radii.md, backgroundColor: t.colors.danger, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>📷 Add photo — required for this finding</Text>
        </Pressable>
      )}

      <TextInput
        accessibilityLabel="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes (optional)"
        multiline
        style={{
          minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md,
          backgroundColor: t.colors.surface, padding: t.spacing.md, color: t.colors.ink,
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save and next"
        disabled={effective === undefined || needsPhoto}
        onPress={() => { save(); onNext(); }}
        style={{
          minHeight: t.minTarget, borderRadius: t.radii.md,
          backgroundColor: effective === undefined || needsPhoto ? t.colors.line : t.colors.primary,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Save & next</Text>
      </Pressable>
    </ScrollView>
  );
}
