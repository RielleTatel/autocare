import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";
import { Icon } from "./Icon";

/**
 * The visible way back from a pushed screen.
 *
 * The navigator runs with `headerShown: false`, so a pushed screen has no
 * chrome of its own. iOS swipe-back and the Android hardware button still work,
 * but neither is discoverable — a member looking at a screen with no exit does
 * not think "swipe from the bezel". This is that affordance, sized to the 48dp
 * member minimum (NFR-027).
 *
 * Renders nothing without `onBack`: a tab root has nowhere to return to, and a
 * dead chevron is worse than none.
 */
export function BackBar({ onBack, title }: { onBack?: () => void; title?: string }) {
  if (!onBack) return null;
  const t = theme;
  return (
    <Pressable
      testID="back-bar"
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onBack}
      style={{
        minHeight: t.minTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.xs ?? 4,
        alignSelf: "flex-start",
        paddingRight: t.spacing.md,
      }}
    >
      <Icon name="chevron-left" size={24} color={t.colors.primary} />
      {title ? (
        <Text style={[t.text("body", 600), { color: t.colors.primary }]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </Pressable>
  );
}
