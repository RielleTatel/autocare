import type { ReactNode } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import { theme } from "../theme";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "deep" | "danger" | "ghost";
type Size = "member" | "field";

type Look = { bg: string; fg: string; border?: string };

const VARIANT: Record<Variant, Look> = {
  primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary },
  secondary: { bg: "transparent", fg: theme.colors.primary, border: theme.colors.primary },
  deep: { bg: theme.colors.primaryDeep, fg: theme.colors.onPrimary },
  danger: { bg: theme.colors.danger, fg: "#FFFFFF" },
  ghost: { bg: "transparent", fg: theme.colors.primary },
};

export function Button({
  children, variant = "primary", size = "member", block, disabled, onPress, testID, icon, accessibilityLabel, style,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  /** Leading glyph, sized to the DS inline step and tinted with the label. */
  icon?: IconName;
  /** Defaults to the label text when `children` is a plain string. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const v = VARIANT[variant];
  const fg = disabled ? theme.colors.inkMuted : v.fg;
  const height = size === "field" ? 56 : theme.minTarget;
  const base: ViewStyle = {
    height,
    minHeight: height,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    backgroundColor: disabled ? theme.colors.line : v.bg,
    borderWidth: v.border ? theme.borders.control : 0,
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
      style={({ pressed }) => [base, pressed && !disabled ? { opacity: theme.motion.pressOpacity } : null]}
    >
      {icon ? <Icon name={icon} size={size === "field" ? 20 : 18} color={fg} /> : null}
      <Text
        style={{
          ...theme.text("body", 600),
          fontSize: size === "field" ? 18 : 16,
          color: fg,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
