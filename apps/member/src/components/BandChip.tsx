import { View, Text, type ViewStyle } from "react-native";
import { theme } from "../theme";
import type { Band } from "@autocare/scoring";

const LABEL: Record<Band, string> = {
  EXCELLENT: "Excellent", GOOD: "Good", FAIR: "Fair", NEEDS_ATTENTION: "Needs attention", CRITICAL: "Critical",
};

/** Band pill — the one place VHS band colours are allowed (product data, not
 *  decoration; Principle 1). Fills come straight from the protected band tokens. */
export function BandChip({ band, style }: { band: Band; style?: ViewStyle }) {
  const b = theme.vhsBands[band];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: b.fill,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        ...style,
      }}
    >
      <Text style={{ ...theme.text("label"), color: b.on, fontWeight: "600" }}>{LABEL[band]}</Text>
    </View>
  );
}
