import { View } from "react-native";
import { fieldTheme } from "../theme";

/**
 * Inspection completion bar. Extracted from CategoryNavScreen so the category
 * list and the point entry screen show the same thing — two hand-rolled copies
 * would drift, and the accessibility value is easy to mistype.
 */
export function ProgressBar({ answered, total }: { answered: number; total: number }) {
  const t = fieldTheme;
  // total can legitimately be 0 before a checklist loads — never divide by it.
  const pct = total === 0 ? 0 : (answered / total) * 100;

  return (
    <View
      // Without `accessible`, the role is set but the node is never exposed as
      // a single element — screen readers skip it entirely.
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: answered }}
      style={{ height: 8, borderRadius: t.radii.pill, backgroundColor: t.colors.line, overflow: "hidden" }}
    >
      <View testID="progress-fill" style={{ width: `${pct}%`, height: "100%", backgroundColor: t.colors.primary }} />
    </View>
  );
}
