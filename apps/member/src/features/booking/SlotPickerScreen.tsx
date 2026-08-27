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
  heldSlotKey,
  onPick,
  onRepick,
}: {
  slots: Slot[];
  loading?: boolean;
  holdSecondsLeft: number | null;
  /** `${bayId}|${start}` of the slot currently under hold, so it reads as selected. */
  heldSlotKey?: string | null;
  onPick: (s: Slot) => void;
  onRepick: () => void;
}) {
  const expired = holdSecondsLeft === 0;
  const locked = holdSecondsLeft !== null && !expired;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      testID="slot-picker-screen"
    >
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
        {slots.map((s) => {
          const key = `${s.bayId}|${s.start}`;
          const selected = heldSlotKey === key;
          // While a hold is live every other time is unreachable — dim them so
          // that reads as state rather than as an unresponsive tap.
          const dimmed = locked && !selected;
          return (
            <Pressable
              key={key}
              testID={`slot-${s.start}`}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: locked }}
              onPress={() => onPick(s)}
              disabled={locked}
              style={{
                minHeight: theme.minTarget,
                paddingHorizontal: theme.spacing.md,
                justifyContent: "center",
                borderWidth: selected ? theme.borders.control : 1,
                borderColor: selected ? theme.colors.primary : theme.colors.line,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.surface,
                opacity: dimmed ? 0.4 : 1,
              }}
            >
              <Text style={[theme.text("code"), { color: theme.colors.ink }]}>{manilaTime(s.start)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
