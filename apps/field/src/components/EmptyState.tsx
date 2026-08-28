import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { fieldTheme } from "../theme";
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
  const t = fieldTheme;
  return (
    <Card pad="lg">
      <View style={{ alignItems: "center", gap: t.spacing.sm }}>
        <Text style={{ ...t.text("h2"), color: tone === "error" ? t.colors.danger : t.colors.ink, textAlign: "center" }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted, textAlign: "center" }}>{body}</Text>
        ) : null}
        {action ? <View style={{ marginTop: t.spacing.sm, alignSelf: "stretch" }}>{action}</View> : null}
      </View>
    </Card>
  );
}
