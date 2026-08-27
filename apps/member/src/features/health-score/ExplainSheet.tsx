import { Image, Text } from "react-native";
import { renderExplanation, type ExplainPoint, type PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";
import { StarRating } from "./StarRating";
import { BottomSheet, MeasuredRow } from "../../components/BottomSheet";

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
    <BottomSheet title={target.point.label} onClose={onClose}>
      {target.status !== "NOT_APPLICABLE" && <StarRating score={starScore} size={22} />}
      <Text testID="explain-sentence" style={{ ...t.text("body"), color: t.colors.inkMuted }}>{sentence}</Text>

      {target.measuredValue !== undefined && th && (
        <MeasuredRow>
          Measured {target.measuredValue}{target.point.unit ? ` ${target.point.unit}` : ""} · good {th.direction === "HIGHER_BETTER" ? "\u2265" : "<"} {th.good}{target.point.unit ? ` ${target.point.unit}` : ""}
        </MeasuredRow>
      )}

      {target.photoUrl && (
        <Image accessibilityLabel="Finding photo" source={{ uri: target.photoUrl }} style={{ width: "100%", height: 180, borderRadius: t.radii.sm }} resizeMode="cover" />
      )}
    </BottomSheet>
  );
}
