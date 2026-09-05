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
import { StatusChip } from "../../components/StatusChip";
import { StatusChoice } from "../../components/StatusChoice";
import type { LocalResult } from "../../shared/db/inspections.repo";

const STATUSES: Array<Exclude<PointStatus, never>> = ["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"];
const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

export interface PointEntryProps {
  point: ConfigPoint;
  initial?: LocalResult;
  onSave(result: LocalResult): void;
  onAddPhoto(): void;
  onNext(): void;
  /** Injected so tests can observe haptics without native modules. */
  onAdverseHaptic?: () => void;
  onBack?(): void;
  title?: string;
  /** Overall inspection completion. Optional — omitted, no bar renders. */
  progress?: { answered: number; total: number };
}

/** F-06 — one point per screen: giant chips (≥56dp), numeric pad + live derived
 *  chip for measured points, blocking photo affordance on adverse findings. */
export function PointEntryScreen({ point, initial, onSave, onAddPhoto, onNext, onAdverseHaptic, onBack, title, progress }: PointEntryProps) {
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
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title={title ?? point.label} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
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
                  onChangeText={setValue}
                  placeholder="0.0"
                />
              </View>
              <Text style={{ ...t.text("h2"), color: t.colors.inkMuted }}>{point.unit}</Text>
            </View>
            {derived && <StatusChip status={derived} testID="derived-status-chip" />}
          </View>
        )}

        <View style={{ gap: t.spacing.sm }}>
          {STATUSES.map((s) => (
            <StatusChoice
              key={s}
              status={s}
              selected={effective === s}
              disabled={point.inputType === "MEASURED" && derived !== undefined && derived !== s}
              onPress={() => pick(s)}
            />
          ))}
        </View>

        {needsPhoto && (
          <Button variant="danger" icon="camera" accessibilityLabel="Add photo (required)" onPress={onAddPhoto}>
            Add photo — required for this finding
          </Button>
        )}

        {photoUris.length > 0 && (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Icon name="image" size={22} color={t.vhsBands.EXCELLENT.fill} />
            <Text style={{ ...t.text("body"), color: t.colors.ink }}>
              {photoUris.length} photo{photoUris.length === 1 ? "" : "s"} attached
            </Text>
          </Card>
        )}

        <FormField
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          multiline
        />

        <Button
          accessibilityLabel="Save and next"
          disabled={effective === undefined || needsPhoto}
          onPress={() => { save(); onNext(); }}
        >
          Save &amp; next
        </Button>
      </ScrollView>
    </View>
  );
}
