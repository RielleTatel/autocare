import { Pressable, Text } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../theme";
import { STATUS_LABELS, statusColor } from "./StatusChip";

/** One of the five stacked status rows on PointEntry. Selected fills with the
 *  band colour; unselected is a plain surface row. Sized for gloves. */
export function StatusChoice({
  status, selected, disabled, onPress, testID,
}: {
  status: PointStatus;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const t = fieldTheme;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={STATUS_LABELS[status]}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: t.minTarget,
        borderRadius: t.radii.md,
        borderWidth: selected ? 0 : t.borders.hairline,
        borderColor: t.colors.line,
        backgroundColor: selected ? statusColor(status) : t.colors.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ ...t.text("h2"), color: selected ? "#FFFFFF" : t.colors.ink }}>
        {STATUS_LABELS[status]}
      </Text>
    </Pressable>
  );
}
