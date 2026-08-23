import React from "react";
import { View, Text, Pressable } from "react-native";
import { theme } from "../../theme";

const manila = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

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
      <View style={{ borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: 6, backgroundColor: theme.colors.surface }}>
        <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{serviceName}</Text>
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{manila(slotStart)}</Text>
        {entitlementLine && (
          <Text testID="entitlement-line" style={[theme.text("label"), { color: theme.colors.primary }]}>
            {entitlementLine}
          </Text>
        )}
      </View>
      <Pressable
        testID="confirm"
        onPress={onConfirm}
        disabled={submitting}
        accessibilityState={{ disabled: !!submitting }}
        style={{
          minHeight: theme.minTarget,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: theme.radii.md,
          backgroundColor: submitting ? theme.colors.line : theme.colors.primary,
        }}
      >
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary }]}>{submitting ? "Booking…" : "Confirm"}</Text>
      </Pressable>
    </View>
  );
}
