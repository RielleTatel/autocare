import { Pressable, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme as t } from "../theme";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";

/** One readable result row, shared by editable review and the accepted report. */
export function FindingRow({ label, status, measurement, notes, photoCount = 0, onPress, accessibilityLabel }: {
  label: string; status?: PointStatus; measurement?: string; notes?: string | null; photoCount?: number;
  onPress?(): void; accessibilityLabel?: string;
}) {
  const content = <>
    <View style={{ flex: 1, gap: 5 }}>
      <Text style={[t.text("body"), { color: t.colors.ink }]}>{label}</Text>
      {measurement ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{measurement}</Text> : null}
      {notes ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{notes}</Text> : null}
      {photoCount > 0 ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{photoCount} photo{photoCount === 1 ? "" : "s"} attached</Text> : null}
    </View>
    {status ? <StatusChip status={status} /> : <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Not recorded</Text>}
    {onPress ? <Icon name="chevron-right" size={16} color={t.colors.inkMuted} /> : null}
  </>;
  const style = { minHeight: t.minTarget, paddingVertical: 14, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, borderBottomWidth: 1, borderColor: t.colors.lineSoft };
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `Edit ${label}`} onPress={onPress} style={({ pressed }) => [style, { backgroundColor: pressed ? t.colors.chassis : "transparent" }]}>{content}</Pressable> : <View style={style}>{content}</View>;
}
