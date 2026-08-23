import { Image, Modal, Pressable, Text, View } from "react-native";
import { renderExplanation, type ExplainPoint, type PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";
import { StarRating } from "./StarRating";

export interface ExplainTarget {
  point: ExplainPoint;
  status: PointStatus;
  measuredValue?: number;
  /** Category-level rows pass a band-derived score for the star row. */
  score?: number;
  photoUrl?: string;
}

function statusBandScore(status: PointStatus): number {
  switch (status) {
    case "GOOD": return 95;
    case "MONITOR": return 80;
    case "ATTENTION": return 50;
    case "CRITICAL": return 20;
    case "NOT_APPLICABLE": return 95;
  }
}

/** FR-115 tap-to-explain bottom sheet. Opens for ANY component — healthy ones
 *  included — with the templated sentence, measured value vs threshold, and the
 *  finding photo if present. Uses the pure renderExplanation (no round trip). */
export function ExplainSheet({ target, onClose }: { target: ExplainTarget | null; onClose: () => void }) {
  const t = theme;
  if (!target) return null;

  const sentence = target.status === "NOT_APPLICABLE"
    ? "This component does not apply to your vehicle, so it was not scored."
    : renderExplanation(target.point, target.status, { measuredValue: target.measuredValue }) ?? "";
  const starScore = target.score ?? statusBandScore(target.status);
  const th = target.point.thresholds;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close explanation" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(22,35,46,0.4)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => undefined} style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: t.radii.md, borderTopRightRadius: t.radii.md, padding: t.spacing.lg, gap: t.spacing.sm }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.line, alignSelf: "center" }} />
          <Text style={{ ...t.text("h1"), color: t.colors.ink }}>{target.point.label}</Text>
          {target.status !== "NOT_APPLICABLE" && <StarRating score={starScore} size={22} />}
          <Text testID="explain-sentence" style={{ ...t.text("body"), color: t.colors.inkMuted }}>{sentence}</Text>

          {target.measuredValue !== undefined && th && (
            <View style={{ backgroundColor: t.colors.chassis, borderRadius: t.radii.sm, padding: t.spacing.sm }}>
              <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
                Measured {target.measuredValue}{target.point.unit ? ` ${target.point.unit}` : ""} · good {th.direction === "HIGHER_BETTER" ? "≥" : "<"} {th.good}{target.point.unit ? ` ${target.point.unit}` : ""}
              </Text>
            </View>
          )}

          {target.photoUrl && (
            <Image accessibilityLabel="Finding photo" source={{ uri: target.photoUrl }} style={{ width: "100%", height: 180, borderRadius: t.radii.sm }} resizeMode="cover" />
          )}

          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ minHeight: t.minTarget, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center", marginTop: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.onPrimary }}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
