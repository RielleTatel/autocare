import type { ReactNode } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import { theme } from "../theme";

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
  children, variant = "primary", size = "member", block, disabled, onPress, testID,
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const v = VARIANT[variant];
  const height = size === "field" ? 56 : theme.minTarget;
  const base: ViewStyle = {
    height,
    minHeight: height,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: disabled ? theme.colors.line : v.bg,
    borderWidth: v.border ? theme.borders.control : 0,
    borderColor: v.border,
    alignSelf: block ? "stretch" : "flex-start",
    width: block ? "100%" : undefined,
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && !disabled ? { opacity: theme.motion.pressOpacity } : null]}
    >
      <Text
        style={{
          ...theme.text("body", 600),
          fontSize: size === "field" ? 18 : 16,
          color: disabled ? theme.colors.inkMuted : v.fg,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
