import { Pressable, Text, View, type ViewStyle } from "react-native";
import { theme } from "../theme";

const INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: "/month",
  QUARTERLY: "/quarter",
  ANNUAL: "/year",
};

/**
 * Membership plan: name, price in the display face, lock-in, inclusions, and one
 * primary action. Ported from `components/subscription/PlanCard.jsx`.
 *
 * Inclusions are listed in full — never "and more". A member deciding between
 * plans has to be able to see everything they gain or lose.
 */
export function PlanCard({
  name, price, interval = "MONTHLY", lockInMonths = 0, inclusions = [],
  selected, actionLabel = "Choose this plan", onSelect, disabled, style, testID,
}: {
  name: string;
  /** Pre-formatted for display, e.g. "₱1,499". */
  price: string;
  interval?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  lockInMonths?: number;
  inclusions?: string[];
  selected?: boolean;
  actionLabel?: string;
  onSelect?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  const t = theme;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={`${name}, ${price}${INTERVAL_LABEL[interval] ?? ""}. ${actionLabel}.`}
      disabled={disabled || !onSelect}
      onPress={onSelect}
      style={({ pressed }) => [
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radii.md,
          padding: t.spacing.md,
          borderWidth: selected ? t.borders.control : 1,
          borderColor: selected ? t.colors.primary : t.colors.line,
          ...style,
        },
        pressed && !disabled ? { opacity: t.motion.pressOpacity } : null,
      ]}
    >
      <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{name}</Text>

      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: t.spacing.xs }}>
        <Text style={{ ...t.text("h1"), color: t.colors.primaryDeep }}>{price}</Text>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{INTERVAL_LABEL[interval] ?? ""}</Text>
      </View>

      <Text style={{ ...t.text("label"), color: t.colors.inkMuted, marginTop: t.spacing.xs }}>
        {lockInMonths > 0 ? `${lockInMonths}-month lock-in` : "No lock-in"}
      </Text>

      <View style={{ marginTop: t.spacing.sm, gap: 2 }}>
        {inclusions.map((line) => (
          <Text key={line} style={{ ...t.text("body"), color: t.colors.ink }}>• {line}</Text>
        ))}
      </View>

      <View
        style={{
          minHeight: t.minTarget,
          marginTop: t.spacing.sm,
          borderRadius: t.radii.sm,
          backgroundColor: disabled ? t.colors.line : t.colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ ...t.text("body", 600), color: disabled ? t.colors.inkMuted : t.colors.onPrimary }}>
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}
