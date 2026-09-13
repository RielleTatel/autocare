import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, type ViewStyle } from "react-native";
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
  children, variant = "primary", size = "member", block, disabled, loading = false, onPress, testID, icon, accessibilityLabel, style,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  /** Keeps the action visually primary while preventing repeat submissions. */
  loading?: boolean;
  onPress?: () => void;
  testID?: string;
  /** Leading glyph, sized to the DS inline step and tinted with the label. */
  icon?: IconName;
  /** Defaults to the label text when `children` is a plain string. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const v = VARIANT[variant];
  const inactive = !!disabled || loading;
  const visuallyDisabled = !!disabled && !loading;
  const fg = visuallyDisabled ? theme.colors.inkMuted : v.fg;
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
    backgroundColor: visuallyDisabled ? theme.colors.line : v.bg,
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
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && !inactive ? { opacity: theme.motion.pressOpacity } : null]}
    >
      {loading ? (
        <ActivityIndicator testID={testID ? `${testID}-loading` : undefined} size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} size={size === "field" ? 20 : 18} color={fg} />
      ) : null}
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
