import { useState, type ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fieldTheme as t } from "../theme";
import { Icon, type IconName } from "./Icon";

/** A consistent working width through capture, review, reports and recovery. */
export const workContent: ViewStyle = {
  padding: t.spacing.md, paddingBottom: t.spacing.lg, gap: t.spacing.md,
  width: "100%", maxWidth: 760, alignSelf: "center",
};
export const wideContent: ViewStyle = { ...workContent, maxWidth: 1120 };

export function ActionBar({ children, hint }: { children: ReactNode; hint?: string }) {
  return <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.colors.surface, borderTopWidth: 1, borderColor: t.colors.line }}>
    <View style={{ ...workContent, paddingVertical: 12, gap: 8 }}>
      {hint ? <Text accessibilityLiveRegion="polite" style={[t.text("label"), { color: t.colors.inkMuted }]}>{hint}</Text> : null}
      {children}
    </View>
  </SafeAreaView>;
}

export function IconButton({ icon, label, onPress, selected = false }: { icon: IconName; label: string; onPress(): void; selected?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minWidth: t.minTarget, minHeight: t.minTarget, alignItems: "center", justifyContent: "center", borderRadius: t.radii.sm, borderWidth: 2, borderColor: focused ? t.colors.primary : "transparent", backgroundColor: selected ? t.colors.chassis : "transparent", opacity: pressed ? 0.7 : 1 })}>
    <Icon name={icon} size={22} color={selected ? t.colors.primaryDeep : t.colors.inkMuted} />
  </Pressable>;
}

export function Disclosure({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <View style={{ borderTopWidth: 1, borderColor: t.colors.line }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
      style={{ minHeight: t.minTarget, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
      <Text style={[t.text("body", 600), { color: t.colors.ink, flex: 1 }]}>{title}</Text>
      <Icon name={open ? "chevron-down" : "chevron-right"} size={20} color={t.colors.inkMuted} />
    </Pressable>
    {open ? <View style={{ gap: 12, paddingBottom: 16 }}>{children}</View> : null}
  </View>;
}
