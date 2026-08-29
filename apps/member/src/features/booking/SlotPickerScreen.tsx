import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Plate } from "../../components/Plate";
import type { Slot } from "./bookingApi";
import { groupByManilaDay, manilaDayOf, partOfDay, type PartOfDay } from "./slotsByDay";

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

const weekdayOf = (date: string) =>
  new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short" }).toUpperCase();

const dayNumOf = (date: string) =>
  new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric" });

const monthOf = (date: string) =>
  new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" });

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const PART_LABEL: Record<PartOfDay, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};
const PART_ORDER: PartOfDay[] = ["MORNING", "AFTERNOON", "EVENING"];

/**
 * M-20 — pick a time. Selecting a slot acquires a 10-minute hold (container). While a hold is live
 * a countdown banner shows; when it lapses (`holdSecondsLeft === 0`) a re-pick prompt appears so the
 * member knows to choose again (FR-043 hold-expiry UX).
 *
 * The API returns a rolling two-week window in one array, so the screen groups it by day and shows
 * one day at a time. Rendered flat it was a wall of repeating clock times with no dates — which
 * looks like duplicated data, not a fortnight of availability.
 */
export function SlotPickerScreen({
  slots,
  loading,
  holdSecondsLeft,
  heldSlotKey,
  vehicle,
  serviceName,
  onPick,
  onRepick,
}: {
  slots: Slot[];
  loading?: boolean;
  holdSecondsLeft: number | null;
  /** `${bayId}|${start}` of the slot currently under hold, so it reads as selected. */
  heldSlotKey?: string | null;
  /** What is being booked, kept in view so the choice always has its subject. */
  vehicle?: { plateNo: string; year: number; make: string; model: string } | null;
  serviceName?: string;
  onPick: (s: Slot) => void;
  onRepick: () => void;
}) {
  const t = theme;
  const expired = holdSecondsLeft === 0;
  const locked = holdSecondsLeft !== null && !expired;

  const days = useMemo(() => groupByManilaDay(slots), [slots]);

  // Follow the held slot's day when there is one, so an expiring hold returns
  // the member to the day they were choosing rather than to the top of the list.
  const heldDay = heldSlotKey ? manilaDayOf(heldSlotKey.split("|").slice(1).join("|")) : null;
  const [picked, setPicked] = useState<string | null>(null);
  const activeDate = picked ?? heldDay ?? days[0]?.date ?? null;
  const active = days.find((d) => d.date === activeDate) ?? null;

  const byPart = useMemo(() => {
    const m = new Map<PartOfDay, Slot[]>();
    for (const s of active?.slots ?? []) {
      const p = partOfDay(s.start);
      m.set(p, [...(m.get(p) ?? []), s]);
    }
    return m;
  }, [active]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      testID="slot-picker-screen"
    >
      <View style={{ gap: 4 }}>
        <Text style={[t.text("h1"), { color: t.colors.primaryDeep }]}>Pick a time</Text>
        {vehicle ? (
          <View testID="booking-subject" style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Plate variant="chip">{vehicle.plateNo}</Plate>
            <Text style={[t.text("label"), { color: t.colors.inkMuted, flex: 1 }]} numberOfLines={1}>
              {vehicle.year} {vehicle.make} {vehicle.model}{serviceName ? ` · ${serviceName}` : ""}
            </Text>
          </View>
        ) : serviceName ? (
          <Text testID="booking-subject" style={[t.text("label"), { color: t.colors.inkMuted }]}>{serviceName}</Text>
        ) : null}
      </View>

      {holdSecondsLeft !== null && !expired && (
        <Text testID="hold-countdown" style={[t.text("label"), { color: t.colors.primary }]}>
          Slot held — {mmss(holdSecondsLeft)} left to confirm
        </Text>
      )}
      {expired && (
        <View testID="hold-expired" style={{ gap: 6 }}>
          <Text style={[t.text("label"), { color: t.colors.danger }]}>Your hold expired. Please pick a time again.</Text>
          <Pressable testID="repick" onPress={onRepick} style={{ minHeight: t.minTarget, justifyContent: "center" }}>
            <Text style={[t.text("label"), { color: t.colors.primary }]}>Refresh times</Text>
          </Pressable>
        </View>
      )}

      {loading && <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Loading times…</Text>}

      {!loading && days.length === 0 && (
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          No open times in the next two weeks. Please check back later.
        </Text>
      )}

      {days.length > 0 && (
        <View style={{ gap: t.spacing.sm }}>
          <Text style={[t.text("label", 600), { color: t.colors.inkMuted, letterSpacing: 0.5 }]}>
            SELECT DATE · {activeDate ? monthOf(activeDate) : ""}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm }}>
            {days.map((d) => {
              const isActive = d.date === activeDate;
              return (
                <Pressable
                  key={d.date}
                  testID={`day-${d.date}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${weekdayOf(d.date)} ${dayNumOf(d.date)}, ${d.slots.length} times available`}
                  onPress={() => setPicked(d.date)}
                  style={{
                    minWidth: 64,
                    paddingVertical: t.spacing.sm,
                    alignItems: "center",
                    gap: 2,
                    borderRadius: t.radii.md,
                    borderWidth: isActive ? t.borders.control : 1,
                    borderColor: isActive ? t.colors.primary : t.colors.line,
                    backgroundColor: isActive ? t.colors.primary : t.colors.surface,
                  }}
                >
                  <Text style={[t.text("label"), { color: isActive ? t.colors.onPrimary : t.colors.inkMuted }]}>
                    {weekdayOf(d.date)}
                  </Text>
                  <Text style={[t.text("h2"), { color: isActive ? t.colors.onPrimary : t.colors.ink }]}>
                    {dayNumOf(d.date)}
                  </Text>
                  {/* The count turns "which day is quiet" into something visible
                      before committing to a day. */}
                  <Text style={[t.text("label"), { color: isActive ? t.colors.onPrimary : t.colors.inkMuted }]}>
                    {d.slots.length}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {active && (
        <View style={{ gap: t.spacing.md }} testID="times-for-day">
          {PART_ORDER.filter((p) => (byPart.get(p) ?? []).length > 0).map((p) => (
            <View key={p} style={{ gap: t.spacing.sm }}>
              <Text style={[t.text("label", 600), { color: t.colors.inkMuted, letterSpacing: 0.5 }]}>
                {PART_LABEL[p].toUpperCase()}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
                {(byPart.get(p) ?? []).map((s) => {
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
                        minHeight: t.minTarget,
                        paddingHorizontal: t.spacing.md,
                        justifyContent: "center",
                        borderWidth: selected ? t.borders.control : 1,
                        borderColor: selected ? t.colors.primary : t.colors.line,
                        borderRadius: t.radii.sm,
                        backgroundColor: t.colors.surface,
                        opacity: dimmed ? 0.4 : 1,
                      }}
                    >
                      <Text style={[t.text("code"), { color: t.colors.ink }]}>{manilaTime(s.start)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
