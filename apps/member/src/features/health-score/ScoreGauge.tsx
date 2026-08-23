import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { Band, Confidence } from "@autocare/scoring";
import { theme } from "../../theme";

const CONFIDENCE_LABEL: Record<Confidence, string> = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence" };

/** Polar point on the 180° gauge track. angleDeg 180 = left end, 0 = right end. */
function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const start = polar(cx, cy, r, fromDeg);
  const end = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  // sweep 0 draws the upper semicircle for a decreasing angle (180 → 0)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

export interface ScoreGaugeProps {
  score: number;
  band?: Band;
  confidence?: Confidence;
  isStale?: boolean;
  daysSinceInspection?: number;
  size?: number;
  /** Field app renders a larger face; both share the geometry. */
  variant?: "member" | "field";
}

/** Shared 180° VHS gauge — band-colored progress arc, display-face numeral,
 *  EN/FIL band label, stale + confidence variants. Reused by M-13 and F-09. */
export function ScoreGauge({ score, band, confidence, isStale, daysSinceInspection, size = 220, variant = "member" }: ScoreGaugeProps) {
  const bandKey = (band ?? bandForScore(score)) as Band;
  const bandInfo = vhsBands[bandKey];
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, score));
  const progressDeg = 180 - (clamped / 100) * 180;
  const arcColor = isStale ? theme.colors.inkMuted : bandInfo.fill;

  return (
    <View accessibilityRole="image" accessibilityLabel={`Vehicle health score ${clamped} out of 100, ${bandInfo.labelEn}`} style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size / 2 + stroke }}>
        <Svg width={size} height={size / 2 + stroke}>
          <Path d={arcPath(cx, cy, r, 180, 0)} stroke={theme.colors.line} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {clamped > 0 && (
            <Path
              testID="gauge-progress"
              accessibilityLabel={arcColor}
              d={arcPath(cx, cy, r, 180, progressDeg)}
              stroke={arcColor}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
            />
          )}
          {/* tiny end cap dot for readability */}
          <Circle cx={polar(cx, cy, r, progressDeg).x} cy={polar(cx, cy, r, progressDeg).y} r={stroke / 2.5} fill={arcColor} />
        </Svg>
        <View style={{ position: "absolute", top: size / 4, left: 0, right: 0, alignItems: "center" }}>
          <Text
            testID="gauge-score"
            style={{ ...theme.text("score"), fontSize: variant === "field" ? 72 : 56, color: isStale ? theme.colors.inkMuted : bandInfo.text }}
          >
            {clamped}
          </Text>
        </View>
      </View>
      <Text testID="gauge-band" style={{ ...theme.text("h2"), color: isStale ? theme.colors.inkMuted : bandInfo.text }}>
        {bandInfo.labelEn}
      </Text>
      <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>{bandInfo.labelFil}</Text>
      {isStale ? (
        <Text testID="gauge-stale" style={{ ...theme.text("label"), color: theme.colors.inkMuted, marginTop: theme.spacing.xs }}>
          Inspected {daysSinceInspection ?? "90+"} days ago
        </Text>
      ) : (
        confidence && (
          <View style={{ marginTop: theme.spacing.xs, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 }}>
            <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>{CONFIDENCE_LABEL[confidence]}</Text>
          </View>
        )
      )}
    </View>
  );
}
