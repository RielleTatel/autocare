import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { theme } from "../theme";
import { Card } from "./Card";

/** One card shape for empty, loading and error — an absence never reads as a bug. */
export function EmptyState({
  title, body, tone = "empty", action,
}: {
  title: string;
  body?: string;
  tone?: "empty" | "loading" | "error";
  action?: ReactNode;
}) {
  return (
    <Card pad="lg">
      <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
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
