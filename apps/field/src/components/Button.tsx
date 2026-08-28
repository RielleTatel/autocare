import type { ReactNode } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "deep" | "danger" | "ghost";
type Look = { bg: string; fg: string; border?: string };

const VARIANT: Record<Variant, Look> = {
  primary: { bg: fieldTheme.colors.primary, fg: fieldTheme.colors.onPrimary },
  secondary: { bg: "transparent", fg: fieldTheme.colors.primary, border: fieldTheme.colors.primary },
  deep: { bg: fieldTheme.colors.primaryDeep, fg: fieldTheme.colors.onPrimary },
  danger: { bg: fieldTheme.colors.danger, fg: "#FFFFFF" },
  ghost: { bg: "transparent", fg: fieldTheme.colors.primary },
};

/** Field buttons are always the 56dp gloved target — there is no compact size. */
export function Button({
  children, variant = "primary", block = true, disabled, onPress, testID, icon, accessibilityLabel, style,
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
  style?: ViewStyle;
}) {
  const v = VARIANT[variant];
  const fg = disabled ? fieldTheme.colors.inkMuted : v.fg;
  const height = fieldTheme.minTarget;
  const base: ViewStyle = {
    height,
    minHeight: height,
    borderRadius: fieldTheme.radii.md,
    paddingHorizontal: fieldTheme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: fieldTheme.spacing.sm,
    backgroundColor: disabled ? fieldTheme.colors.line : v.bg,
    borderWidth: v.border ? fieldTheme.borders.control : 0,
    borderColor: v.border,
    alignSelf: block ? "stretch" : "flex-start",
    width: block ? "100%" : undefined,
    ...style,
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && !disabled ? { opacity: fieldTheme.motion.pressOpacity } : null]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ ...fieldTheme.text("body", 600), color: fg }}>{children}</Text>
    </Pressable>
  );
}
