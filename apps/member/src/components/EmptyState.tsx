import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { theme } from "../theme";
import { Card } from "./Card";
import { Icon, type IconName } from "./Icon";

/** One card shape for empty, loading and error — an absence never reads as a bug. */
export function EmptyState({
  title, body, tone = "empty", action, icon,
}: {
  title: string;
  body?: string;
  tone?: "empty" | "loading" | "error";
  action?: ReactNode;
  /** Optional hero glyph. Gives an empty screen something to look at that is
   *  about the missing thing, rather than leaving a card of text in space. */
  icon?: IconName;
}) {
  return (
    <Card pad="lg">
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
        {icon ? (
          <View
            testID="empty-state-icon"
            style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: theme.colors.chassis,
              alignItems: "center", justifyContent: "center",
              marginBottom: theme.spacing.xs,
            }}
          >
            <Icon name={icon} size={40} color={theme.colors.primaryDeep} />
          </View>
        ) : null}
        <Text style={{ ...theme.text("h2"), color: tone === "error" ? theme.colors.danger : theme.colors.ink, textAlign: "center" }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ ...theme.text("body"), color: theme.colors.inkMuted, textAlign: "center" }}>{body}</Text>
        ) : null}
        {action ? <View style={{ marginTop: theme.spacing.sm }}>{action}</View> : null}
      </View>
    </Card>
  );
}
