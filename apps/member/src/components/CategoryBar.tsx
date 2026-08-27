import { Pressable, Text, View, type ViewStyle } from "react-native";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import { theme } from "../theme";
import { StarRating } from "../features/health-score/StarRating";

/**
 * One inspection category: label, score, band-coloured bar, and the weight +
 * point-count footnote that shows how the number was reached. Ported from the
 * design system's `components/vhs/CategoryBar.jsx`.
 *
 * Band colour here is legitimate — this is score data, not decoration.
 */
export function CategoryBar({
  label, score, weight, points, showStars = true, compact, onPress, style, testID,
}: {
  label: string;
  score: number;
  weight?: number;
  points?: number;
  showStars?: boolean;
  compact?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}) {
  const t = theme;
  const band = bandForScore(score);
  const b = vhsBands[band];
  const barHeight = compact ? 8 : 12;
  const role = compact ? "body" : "h2";

  const footnote = [
    weight != null ? `Weight ${weight}%` : null,
    points != null ? `${points} points checked` : null,
  ].filter(Boolean).join(" · ");

  const body = (
    <View style={{ gap: t.spacing.xs, ...style }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.spacing.sm }}>
        <Text style={{ ...t.text(role), color: t.colors.ink, flex: 1 }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
          {showStars && !compact ? <StarRating score={score} size={16} /> : null}
          <Text style={{ ...t.text(role), color: b.text }}>{Math.round(score)}</Text>
        </View>
      </View>

      <View style={{ height: barHeight, borderRadius: t.radii.pill, backgroundColor: t.colors.chassis, overflow: "hidden" }}>
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={{
            width: `${Math.max(0, Math.min(100, score))}%`,
            height: "100%",
            backgroundColor: b.fill,
            borderRadius: t.radii.pill,
          }}
        />
      </View>

      {footnote ? <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{footnote}</Text> : null}
    </View>
  );

  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, score ${Math.round(score)}. Tap to explain.`}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: t.motion.pressOpacity } : null)}
    >
      {body}
    </Pressable>
  );
}
