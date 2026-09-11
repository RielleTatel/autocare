import React from "react";
import { View, Text } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";

const manila = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * M-22 — confirm. Summarises the service + time and, when the booking draws on a plan entitlement,
 * shows the usage line ("Uses 1 of N monthly inspections"). Presentational only.
 */
export function ConfirmScreen({
  serviceName,
  slotStart,
  entitlementLine,
  submitting,
  onConfirm,
}: {
  serviceName: string;
  slotStart: string;
  entitlementLine: string | null;
  submitting?: boolean;
  onConfirm: () => void;
}) {
  return (
    <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.chassis }} testID="confirm-screen">
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Confirm booking</Text>
      <Card style={{ gap: 6 }}>
        <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{serviceName}</Text>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{manila(slotStart)}</Text>
        {entitlementLine && (
          <Text testID="entitlement-line" style={[theme.text("label"), { color: theme.colors.primary }]}>
            {entitlementLine}
          </Text>
        )}
      </Card>
      <Button block testID="confirm" disabled={submitting} onPress={onConfirm}>
        {submitting ? "Booking…" : "Confirm"}
      </Button>
    </View>
  );
}
