import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { Band } from "@autocare/scoring";
import { fieldTheme } from "../theme";

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const s = polar(cx, cy, r, fromDeg);
  const e = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * The 0–100 VHS gauge — a half arc that grows from its left origin, same
 * geometry as the member gauge. The numeral is pinned to the design system's
 * `--ac-size-score` (72) rather than the field type step: it is sized by the
 * gauge geometry, not by the running text scale.
 */
export function ScoreGauge({
  score, band, size = 240, confidence,
}: {
  score: number;
  band?: Band;
  size?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}) {
  const t = fieldTheme;
  const stroke = t.borders.gaugeStroke;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const progressDeg = 180 - (clamped / 100) * 180;
  const bandInfo = vhsBands[(band ?? bandForScore(clamped)) as Band];
  const head = polar(cx, cy, r, progressDeg);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size / 2 + stroke}>
        <Path d={arcPath(cx, cy, r, 180, 0)} stroke={t.colors.line} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {clamped > 0 && (
          <Path d={arcPath(cx, cy, r, 180, progressDeg)} stroke={bandInfo.fill} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}
        <Circle cx={head.x} cy={head.y} r={stroke / 2.5} fill={bandInfo.fill} />
      </Svg>
      <View style={{ position: "absolute", top: size / 4, alignItems: "center" }}>
        <Text style={{ ...t.text("score"), fontSize: 72, color: bandInfo.text }}>{clamped}</Text>
      </View>
      <Text style={{ ...t.text("h2"), color: bandInfo.text }}>
        {bandInfo.labelEn} · {bandInfo.labelFil}
      </Text>
      {confidence ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{confidence} confidence</Text>
      ) : null}
    </View>
  );
}
