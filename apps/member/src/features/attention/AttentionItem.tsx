import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Plate } from "../../components/Plate";
import type { AttentionItem as Item, AttentionSeverity } from "./attentionApi";

export const SEVERITY_COLOR: Record<AttentionSeverity, string> = {
  CRITICAL: theme.vhsBands.CRITICAL.fill,
  ATTENTION: theme.vhsBands.NEEDS_ATTENTION.fill,
  MONITOR: theme.vhsBands.FAIR.fill,
  INFO: theme.colors.primary,
};
const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  CRITICAL: "Critical", ATTENTION: "Needs attention", MONITOR: "Monitor", INFO: "Info",
};

export function AttentionItemRow({ item, showPlate, onPress }: { item: Item; showPlate?: boolean; onPress?: (item: Item) => void }) {
  const t = theme;
  return (
    <Card
      interactive
      accessibilityLabel={`${item.title} — ${SEVERITY_LABEL[item.severity]}`}
      accent={SEVERITY_COLOR[item.severity]}
      onPress={() => onPress?.(item)}
      style={{ gap: t.spacing.xs }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
        <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{item.title}</Text>
        {showPlate && item.plate ? <Plate variant="plain" style={{ color: t.colors.inkMuted }}>{item.plate}</Plate> : null}
      </View>
      <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{item.body}</Text>
      <Text style={{ ...t.text("label"), color: SEVERITY_COLOR[item.severity] }}>{SEVERITY_LABEL[item.severity]} ›</Text>
    </Card>
  );
}
