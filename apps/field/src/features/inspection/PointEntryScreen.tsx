import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { deriveStatus } from "@autocare/scoring";
import type { ConfigPoint, PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { FormField } from "../../components/FormField";
import { FieldNav } from "../../components/FieldNav";
import { ProgressBar } from "../../components/ProgressBar";
import { ActionBar, workContent } from "../../components/FieldLayout";
import { StatusChip } from "../../components/StatusChip";
import { StatusChoice } from "../../components/StatusChoice";
import type { LocalResult } from "../../shared/db/inspections.repo";

const STATUSES: Array<Exclude<PointStatus, never>> = ["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"];
const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

export interface PointEntryProps {
  point: ConfigPoint;
  initial?: LocalResult;
  onSave(result: LocalResult): void | Promise<void>;
  onAddPhoto(): void;
  onNext(): void;
  /** Injected so tests can observe haptics without native modules. */
  onAdverseHaptic?: () => void;
  onBack?(): void;
  title?: string;
  /** Overall inspection completion. Optional — omitted, no bar renders. */
  progress?: { answered: number; total: number };
}

/** Focused finding editor with optional notes/photos and a persistent next action. */
export function PointEntryScreen({ point, initial, onSave, onAddPhoto, onNext, onAdverseHaptic, onBack, title, progress }: PointEntryProps) {
  const t = fieldTheme;
  const [status, setStatus] = useState<PointStatus | undefined>(initial?.status as PointStatus | undefined);
  const [value, setValue] = useState<string>(initial?.measuredValue?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const photoUris = initial?.photoUris ?? [];

  const derived = useMemo<PointStatus | undefined>(() => {
    if (point.inputType !== "MEASURED" || !point.thresholds) return undefined;
    const v = Number(value);
    if (value.trim() === "" || Number.isNaN(v)) return undefined;
    return deriveStatus(v, point.thresholds);
  }, [point, value]);

  const effective = point.inputType === "MEASURED" ? (derived ?? status) : status;
  const invalidValue = point.inputType === "MEASURED" && value.trim() !== "" && !Number.isFinite(Number(value));

  const save = async (override: Partial<LocalResult> = {}) => {
    await onSave({
      pointCode: point.code,
      status: effective,
      measuredValue: point.inputType === "MEASURED" && value.trim() !== "" ? Number(value) : undefined,
      notes: notes.trim() === "" ? undefined : notes,
      photoUris,
      ...override,
    });
  };

  const leave = async (next: () => void) => {
    if (saving) return;
    setSaving(true); setSaveError(null);
    try { await save(); next(); }
    catch (e) { setSaveError(e instanceof Error ? e.message : "Could not save this finding. Try again."); }
    finally { setSaving(false); }
  };

  const pick = (s: PointStatus) => {
    setStatus(s);
    void save({ status: s }).catch((e) => setSaveError(e instanceof Error ? e.message : "Could not save this finding."));
    if (ADVERSE.includes(s)) onAdverseHaptic?.();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title={title ?? point.label} onBack={onBack ? () => { void leave(onBack); } : undefined} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={workContent}>
        {/* One point per screen means no sense of how much is left without
            this — the category list is several taps away mid-inspection. */}
        {progress ? (
          <View style={{ gap: 6 }}>
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
              {progress.answered} of {progress.total} points recorded
            </Text>
            <ProgressBar answered={progress.answered} total={progress.total} />
          </View>
        ) : null}

        <View>
          <Text style={{ ...t.text("h1"), color: t.colors.ink }}>{point.label}</Text>
          {point.labelFil ? (
            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{point.labelFil}</Text>
          ) : null}
        </View>

        {point.inputType === "MEASURED" && (
          <View style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <FormField
                  accessibilityLabel={`${point.label} measured value`}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={(v) => {
                    setValue(v);
                    const measuredValue = v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
                    const status = measuredValue !== undefined && point.thresholds ? deriveStatus(measuredValue, point.thresholds) : undefined;
                    void save({ measuredValue, status }).catch((e) => setSaveError(String(e)));
                  }}
                  placeholder="0.0"
                />
              </View>
              <Text style={{ ...t.text("h2"), color: t.colors.inkMuted }}>{point.unit}</Text>
            </View>
            {derived && <StatusChip status={derived} testID="derived-status-chip" />}
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
          {STATUSES.map((s) => (
            <View key={s} style={{ width: s === "NOT_APPLICABLE" ? "100%" : "48%", flexGrow: 1 }}>
            <StatusChoice
              status={s}
              selected={effective === s}
              disabled={point.inputType === "MEASURED" && derived !== undefined && derived !== s}
              onPress={() => pick(s)}
            />
            </View>
          ))}
        </View>

        {photoUris.length > 0 && (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Icon name="image" size={22} color={t.vhsBands.EXCELLENT.fill} />
            <Text style={{ ...t.text("body"), color: t.colors.ink }}>
              {photoUris.length} photo{photoUris.length === 1 ? "" : "s"} attached
            </Text>
          </Card>
        )}

        <FormField
          label="Notes (optional)"
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={(next) => { setNotes(next); void save({ notes: next.trim() || undefined }).catch((e) => setSaveError(String(e))); }}
          placeholder="Notes (optional)"
          multiline
        />

        <Button block={false} variant="ghost" icon="camera" accessibilityLabel="Add photo (optional)" onPress={() => { void leave(onAddPhoto); }}>Add photo (optional)</Button>

        {saveError ? <Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{saveError}</Text> : null}
      </ScrollView>
      <ActionBar hint={invalidValue ? "Enter a valid measurement." : effective === undefined ? "Record a status or measurement to continue." : undefined}>
        <Button
          accessibilityLabel="Save and next"
          disabled={effective === undefined || invalidValue || saving}
          onPress={() => { void leave(onNext); }}
        >
          Save &amp; next
        </Button>
      </ActionBar>
    </View>
  );
}
