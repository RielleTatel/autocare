import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import type { Slot } from "./bookingApi";

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * M-20 — pick a time. Selecting a slot acquires a 10-minute hold (container). While a hold is live
 * a countdown banner shows; when it lapses (`holdSecondsLeft === 0`) a re-pick prompt appears so the
 * member knows to choose again (FR-043 hold-expiry UX).
 */
export function SlotPickerScreen({
  slots,
  loading,
  holdSecondsLeft,
  onPick,
  onRepick,
}: {
  slots: Slot[];
  loading?: boolean;
  holdSecondsLeft: number | null;
  onPick: (s: Slot) => void;
  onRepick: () => void;
}) {
  const expired = holdSecondsLeft === 0;
  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }} testID="slot-picker-screen">
      <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Pick a time</Text>

      {holdSecondsLeft !== null && !expired && (
        <Text testID="hold-countdown" style={[theme.text("label"), { color: theme.colors.primary }]}>
          Slot held — {mmss(holdSecondsLeft)} left to confirm
        </Text>
      )}
      {expired && (
        <View testID="hold-expired" style={{ gap: 6 }}>
          <Text style={[theme.text("label"), { color: theme.colors.danger }]}>Your hold expired. Please pick a time again.</Text>
          <Pressable testID="repick" onPress={onRepick} style={{ minHeight: theme.minTarget, justifyContent: "center" }}>
            <Text style={[theme.text("label"), { color: theme.colors.primary }]}>Refresh times</Text>
          </Pressable>
        </View>
      )}

      {loading && <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Loading times…</Text>}
      {!loading && slots.length === 0 && (
        <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>No open slots for this day.</Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {slots.map((s) => (
          <Pressable
            key={`${s.bayId}|${s.start}`}
            testID={`slot-${s.start}`}
            onPress={() => onPick(s)}
            disabled={holdSecondsLeft !== null && !expired}
            style={{
              minHeight: theme.minTarget,
              paddingHorizontal: theme.spacing.md,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: theme.colors.line,
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text style={[theme.text("code"), { color: theme.colors.ink }]}>{manilaTime(s.start)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
