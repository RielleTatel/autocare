import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { fieldTheme as t } from "../theme";
import { IconButton } from "./FieldLayout";

export function Reference({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const clipboard = (globalThis as unknown as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator?.clipboard;
  return <View style={{ gap: 4 }}>
    <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{label}{copied ? " · Copied" : ""}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text selectable accessibilityLabel={`${label}: ${value}`} style={[t.text("code"), { color: t.colors.ink, flex: 1 }]}>{value}</Text>
      {Platform.OS === "web" && clipboard ? <IconButton icon="copy" label={`Copy ${label}`} onPress={() => { void clipboard.writeText(value).then(() => setCopied(true)).catch(() => setError(true)); }} /> : null}
    </View>
    {error || Platform.OS !== "web" ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Select the reference to copy it.</Text> : null}
  </View>;
}
