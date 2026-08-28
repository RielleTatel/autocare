import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "./Icon";

/**
 * The bar every field screen wears: 52dp of surface, a hairline underneath, a
 * primary back affordance and the screen title. `right` takes a status slot —
 * the task list puts the signed-in mechanic there.
 */
export function FieldNav({
  title, onBack, right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const t = fieldTheme;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.sm,
        minHeight: 52,
        backgroundColor: t.colors.surface,
        borderBottomWidth: t.borders.hairline,
        borderBottomColor: t.colors.line,
        paddingHorizontal: t.spacing.sm,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: t.spacing.xs }}
        >
          <Icon name="chevron-left" size={22} color={t.colors.primary} />
          <Text style={{ ...t.text("h2"), color: t.colors.primary }}>Back</Text>
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
