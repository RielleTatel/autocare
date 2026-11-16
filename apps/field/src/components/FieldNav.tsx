import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "./Icon";

/**
 * The bar every field screen wears: 56dp of surface, a hairline underneath, a
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
        minHeight: 56,
        backgroundColor: t.colors.surface,
        borderBottomWidth: t.borders.hairline,
        borderBottomColor: t.colors.line,
        paddingHorizontal: t.spacing.md,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{ alignItems: "flex-start", justifyContent: "center", minHeight: 56, minWidth: 56 }}
        >
          <Icon name="chevron-left" size={22} color={t.colors.primary} />
        </Pressable>
      ) : null}
      <Text numberOfLines={1} accessibilityRole="header" style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
