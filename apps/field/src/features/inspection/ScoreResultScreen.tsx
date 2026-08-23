import { ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { Band } from "@autocare/scoring";
import { fieldTheme } from "../../theme";

export type FieldScore = {
  score: number;
  band: Band;
  overrideApplied: string;
  topDetractors: Array<{ label: string; status: string; recommendation: string }>;
};

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

/** F-09 — gauge (same geometry as the member ScoreGauge) + a "what to tell the
 *  customer" summary. Shown after a synced submission returns its score. */
export function ScoreResultScreen({ result, offline }: { result?: FieldScore; offline?: boolean }) {
  const t = fieldTheme;

  if (!result) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
        <Text style={[t.text("h1"), { color: t.colors.ink, textAlign: "center" }]}>Inspection submitted</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.sm }]}>
          {offline ? "Score will appear once this device syncs." : "Computing score…"}
        </Text>
      </View>
    );
  }

  const size = 240;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, result.score));
  const progressDeg = 180 - (clamped / 100) * 180;
  const bandInfo = vhsBands[(result.band ?? bandForScore(clamped)) as Band];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.lg }}>
      <View style={{ alignItems: "center", paddingTop: t.spacing.md }}>
        <Svg width={size} height={size / 2 + stroke}>
          <Path d={arcPath(cx, cy, r, 180, 0)} stroke={t.colors.line} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          {clamped > 0 && <Path d={arcPath(cx, cy, r, 180, progressDeg)} stroke={bandInfo.fill} strokeWidth={stroke} fill="none" strokeLinecap="round" />}
          <Circle cx={polar(cx, cy, r, progressDeg).x} cy={polar(cx, cy, r, progressDeg).y} r={stroke / 2.5} fill={bandInfo.fill} />
        </Svg>
        <View style={{ position: "absolute", top: size / 4, alignItems: "center" }}>
          <Text style={{ ...t.text("score"), fontSize: 72, color: bandInfo.text }}>{clamped}</Text>
        </View>
        <Text style={[t.text("h2"), { color: bandInfo.text }]}>{bandInfo.labelEn} · {bandInfo.labelFil}</Text>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>What to tell the customer</Text>
        {result.overrideApplied !== "NONE" && (
          <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.danger, padding: t.spacing.md }}>
            <Text style={[t.text("body"), { color: t.colors.danger }]}>
              A safety-critical item {result.overrideApplied === "SAFETY_CRITICAL" ? "is in unsafe condition" : "needs attention"} — explain the score is capped until it is fixed.
            </Text>
          </View>
        )}
        {result.topDetractors.map((d, i) => (
          <View key={i} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>{d.label}</Text>
            <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{d.recommendation}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: t.spacing.xl }} />
    </ScrollView>
  );
}
