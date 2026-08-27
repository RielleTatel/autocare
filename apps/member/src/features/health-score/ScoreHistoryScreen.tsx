import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { vhsBands } from "@autocare/design-tokens";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import type { HealthScoreHistoryPoint } from "./healthScoreApi";

/** M-15 — score-vs-time line chart with odometer toggle and a shaded stale zone
 *  past 90 days. Built on plain react-native-svg (no extra native dependency). */
export function ScoreHistoryScreen({ history }: { history: HealthScoreHistoryPoint[] }) {
  const t = theme;
  const [xAxis, setXAxis] = useState<"time" | "odometer">("time");

  if (history.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted, textAlign: "center" }}>No inspection history yet.</Text>
      </View>
    );
  }

  const W = 320;
  const H = 200;
  const pad = 32;
  const now = Date.now();

  const xValue = (p: HealthScoreHistoryPoint): number =>
    xAxis === "time" ? new Date(p.computedAt).getTime() : (p.odometerKm ?? 0);
  const xs = history.map(xValue);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const sx = (v: number) => pad + ((v - minX) / (maxX - minX)) * (W - 2 * pad);
  const sy = (score: number) => pad + (1 - score / 100) * (H - 2 * pad);

  const points = history.map((p) => ({ x: sx(xValue(p)), y: sy(p.score), p }));
  const path = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

  // Stale zone: x-range older than 90 days (time axis only)
  const staleCutoff = now - 90 * 86_400_000;
  const staleX = xAxis === "time" && staleCutoff > minX ? sx(Math.min(staleCutoff, maxX)) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Score history</Text>
      <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
        {(["time", "odometer"] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={`X axis ${mode}`}
            accessibilityState={{ selected: xAxis === mode }}
            onPress={() => setXAxis(mode)}
            style={{ paddingHorizontal: t.spacing.md, minHeight: 36, justifyContent: "center", borderRadius: t.radii.pill, backgroundColor: xAxis === mode ? t.colors.primary : t.colors.surface, borderWidth: 1, borderColor: t.colors.line }}
          >
            <Text style={{ ...t.text("label"), color: xAxis === mode ? t.colors.onPrimary : t.colors.ink }}>{mode === "time" ? "By date" : "By odometer"}</Text>
          </Pressable>
        ))}
      </View>

      <Card pad="none" style={{ padding: t.spacing.sm }}>
        <Svg width={W} height={H}>
          {staleX !== null && staleX < W - pad && (
            <Rect testID="stale-zone" x={staleX} y={pad} width={W - pad - staleX} height={H - 2 * pad} fill={theme.colors.inkMuted} opacity={0.12} />
          )}
          {/* axes */}
          <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={t.colors.line} strokeWidth={1} />
          <Line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={t.colors.line} strokeWidth={1} />
          <Path testID="history-line" d={path} stroke={t.colors.primary} strokeWidth={2} fill="none" />
          {points.map((pt, i) => (
            <Circle key={i} cx={pt.x} cy={pt.y} r={4} fill={pt.p.isStale ? t.colors.inkMuted : vhsBands[bandFor(pt.p.score)].fill} />
          ))}
        </Svg>
      </Card>

      <View style={{ gap: t.spacing.xs }}>
        {[...history].reverse().map((p) => (
          <Card key={p.id} pad="none" style={{ flexDirection: "row", justifyContent: "space-between", padding: t.spacing.sm }}>
            <Text style={{ ...t.text("body"), color: t.colors.ink }}>{new Date(p.computedAt).toLocaleDateString()}</Text>
            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{p.odometerKm != null ? `${p.odometerKm} km` : "—"}</Text>
            <Text style={{ ...t.text("h2"), color: p.isStale ? t.colors.inkMuted : vhsBands[bandFor(p.score)].text }}>{p.score}</Text>
          </Card>
        ))}
      </View>
      <View style={{ height: t.spacing.xl }} />
    </ScrollView>
  );
}

function bandFor(score: number): keyof typeof vhsBands {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}
