import { useState, type ReactNode } from "react";
import { Pressable, Text, type AccessibilityState, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "deep" | "danger" | "ghost";
type Look = { bg: string; fg: string; border?: string };

const VARIANT: Record<Variant, Look> = {
  primary: { bg: fieldTheme.colors.primaryDeep, fg: fieldTheme.colors.onPrimary },
  secondary: { bg: fieldTheme.colors.surface, fg: fieldTheme.colors.ink, border: fieldTheme.colors.line },
  deep: { bg: fieldTheme.colors.primaryDeep, fg: fieldTheme.colors.onPrimary },
  danger: { bg: fieldTheme.colors.danger, fg: "#FFFFFF" },
  ghost: { bg: "transparent", fg: fieldTheme.colors.primary },
};

/** Field buttons are always the 56dp gloved target — there is no compact size. */
export function Button({
  children, variant = "primary", block = true, disabled, onPress, testID, icon, accessibilityLabel, accessibilityState, style,
}: {
  children: ReactNode;
  variant?: Variant;
  /** Field buttons default to full-bleed; pass false for an inline action. */
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: IconName;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  style?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  const v = VARIANT[variant];
  const fg = disabled ? fieldTheme.colors.inkMuted : v.fg;
  const height = fieldTheme.minTarget;
  const base: ViewStyle = {
    minHeight: height,
    borderRadius: fieldTheme.radii.sm,
    paddingHorizontal: fieldTheme.spacing.md,
    paddingVertical: fieldTheme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: fieldTheme.spacing.sm,
    backgroundColor: disabled ? fieldTheme.colors.line : v.bg,
    borderWidth: 2,
    borderColor: focused ? fieldTheme.colors.primary : v.border ?? "transparent",
    alignSelf: block ? "stretch" : "flex-start",
    width: block ? "100%" : undefined,
    ...style,
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [base, pressed && !disabled ? { opacity: fieldTheme.motion.pressOpacity } : null]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ ...fieldTheme.text("body", 600), color: fg, flexShrink: 1, textAlign: "center" }}>{children}</Text>
    </Pressable>
  );
}
