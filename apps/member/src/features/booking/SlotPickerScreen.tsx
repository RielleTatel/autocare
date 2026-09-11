import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon, type IconName } from "../../components/Icon";
import { Plate } from "../../components/Plate";
import type { Slot } from "./bookingApi";
import { groupByManilaDay, manilaDayOf, partOfDay, type PartOfDay } from "./slotsByDay";

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

/** "1h", "90m", "1h 30m" — how long the bay is held, so the member can see the
 *  shape of their afternoon before committing to a time. */
function durationOf(start: string, end: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Dates are keyed YYYY-MM-DD; noon anchors the parse so a timezone shift can
 *  never roll the label onto the neighbouring day. */
const at = (date: string) => new Date(`${date}T12:00:00+08:00`);

const weekdayOf = (date: string) =>
  at(date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short" });

const dayNumOf = (date: string) =>
  at(date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "2-digit" });

const monthOf = (date: string) =>
  at(date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", year: "numeric" });

/** "2026-02" — the page key for month paging. */
const monthKeyOf = (date: string) => date.slice(0, 7);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Each time carries its own part-of-day tag, so the list needs no section
 *  headers and a time is never ambiguous when read on its own. */
const PART_ICON: Record<PartOfDay, IconName> = {
  MORNING: "sunrise",
  AFTERNOON: "sun",
  EVENING: "sunset",
};

/**
 * Every civil date from `from` to `to` inclusive.
 *
 * The grid shows the whole booking window, not just the days that happen to
 * have availability: a fully-booked Tuesday that simply vanished would read as
 * a calendar bug. It renders greyed instead, which says "we looked, there is
 * nothing here" — the same thing the reference does with its out-of-range days.
 */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = at(from); manilaDayOf(d.toISOString()) <= to; d.setDate(d.getDate() + 1)) {
    out.push(manilaDayOf(d.toISOString()));
  }
  return out;
}

/** Round icon button — the month steppers and the back affordance. */
function IconButton({
  name, onPress, disabled, label, testID,
}: {
  name: "chevron-left" | "chevron-right";
  onPress?: () => void;
  disabled?: boolean;
  label: string;
  testID?: string;
}) {
  const t = theme;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 36, height: 36, borderRadius: t.radii.pill,
          backgroundColor: t.colors.surface,
          borderWidth: t.borders.hairline, borderColor: t.colors.lineSoft,
          alignItems: "center", justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        },
        pressed && !disabled ? { opacity: t.motion.pressOpacity } : null,
      ]}
    >
      <Icon name={name} size={20} color={t.colors.ink} />
    </Pressable>
  );
}

/**
 * M-20 — pick a time. A date grid over the booking window, then that day's open
 * times, then one explicit commit.
 *
 * Selecting a time is local; `onPick` fires from the CTA. Tapping a time used to
 * spend a 10-minute hold and navigate on a single tap, which is a lot of
 * commitment for one touch — and a mis-tap cost the member the slot.
 *
 * While a hold is live a countdown shows; when it lapses (`holdSecondsLeft === 0`)
 * a re-pick prompt appears so the member knows to choose again (FR-043).
 *
 * The API returns a rolling two-week window in one array, so the screen groups it
 * by day and shows one day at a time. Rendered flat it was a wall of repeating
 * clock times with no dates — which looks like duplicated data, not a fortnight
 * of availability.
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
  onBack,
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
  /** Back to the service step. Omit and the affordance is not rendered. */
  onBack?: () => void;
}) {
  const t = theme;
  const expired = holdSecondsLeft === 0;
  const locked = holdSecondsLeft !== null && !expired;

  const days = useMemo(() => groupByManilaDay(slots), [slots]);
  /** date → that day's slots, for the greyed-vs-open test in the grid. */
  const slotsByDate = useMemo(() => new Map(days.map((d) => [d.date, d.slots])), [days]);

  // Follow the held slot's day when there is one, so an expiring hold returns
  // the member to the day they were choosing rather than to the top of the list.
  const heldDay = heldSlotKey ? manilaDayOf(heldSlotKey.split("|").slice(1).join("|")) : null;
  const [picked, setPicked] = useState<string | null>(null);
  const activeDate = picked ?? heldDay ?? days[0]?.date ?? null;
  const active = activeDate ? { date: activeDate, slots: slotsByDate.get(activeDate) ?? [] } : null;

  // Every date in the window, and the months it spans — the grid pages by month.
  const allDates = useMemo(
    () => (days.length ? datesBetween(days[0].date, days[days.length - 1].date) : []),
    [days],
  );
  const months = useMemo(() => [...new Set(allDates.map(monthKeyOf))], [allDates]);
  const [monthPage, setMonthPage] = useState<string | null>(null);
  const activeMonth = monthPage ?? (activeDate ? monthKeyOf(activeDate) : months[0]) ?? null;
  const monthIndex = activeMonth ? months.indexOf(activeMonth) : -1;
  const gridDates = useMemo(
    () => allDates.filter((d) => monthKeyOf(d) === activeMonth),
    [allDates, activeMonth],
  );

  const [pickedSlotKey, setPickedSlotKey] = useState<string | null>(null);
  const selectedKey = heldSlotKey ?? pickedSlotKey;
  const selectedSlot = active?.slots.find((s) => `${s.bayId}|${s.start}` === selectedKey) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }} testID="slot-picker-screen">
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
        {/* Back affordance and subject share one row: the arrow alone left a
            band of empty chrome across the top, and what is being booked is
            exactly the thing that belongs next to the way out of the flow. */}
        {(onBack || vehicle || serviceName) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
            {onBack ? (
              <Pressable
                testID="slot-back"
                accessibilityRole="button"
                accessibilityLabel="Back to services"
                onPress={onBack}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    width: 44, height: 44, borderRadius: t.radii.sm,
                    backgroundColor: t.colors.surface,
                    alignItems: "center", justifyContent: "center",
                  },
                  pressed ? { opacity: t.motion.pressOpacity } : null,
                ]}
              >
                <Icon name="chevron-left" size={22} color={t.colors.ink} />
              </Pressable>
            ) : null}

            {vehicle ? (
              <View testID="booking-subject" style={{ flex: 1, gap: 4 }}>
                <Plate variant="chip">{vehicle.plateNo}</Plate>
                <Text style={[t.text("label"), { color: t.colors.inkMuted }]} numberOfLines={1}>
                  {vehicle.year} {vehicle.make} {vehicle.model}{serviceName ? ` · ${serviceName}` : ""}
                </Text>
              </View>
            ) : serviceName ? (
              <Text testID="booking-subject" style={[t.text("label"), { color: t.colors.inkMuted, flex: 1 }]} numberOfLines={1}>
                {serviceName}
              </Text>
            ) : null}
          </View>
        )}

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

        {gridDates.length > 0 && (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[t.text("h1"), { color: t.colors.ink }]}>
                {activeMonth ? monthOf(`${activeMonth}-01`) : ""}
              </Text>
              {/* Only rendered when the window actually spans more than one
                  month — a stepper that can never step is furniture. */}
              {months.length > 1 ? (
                <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
                  <IconButton
                    testID="month-prev"
                    name="chevron-left"
                    label="Previous month"
                    disabled={monthIndex <= 0}
                    onPress={() => setMonthPage(months[monthIndex - 1])}
                  />
                  <IconButton
                    testID="month-next"
                    name="chevron-right"
                    label="Next month"
                    disabled={monthIndex >= months.length - 1}
                    onPress={() => setMonthPage(months[monthIndex + 1])}
                  />
                </View>
              ) : null}
            </View>

            {/* Exact thirds, gutter carried as per-cell padding: a percentage
                basis plus flexGrow lets a trailing row of one or two cells
                stretch to fill the row, which breaks the grid. The negative
                margin cancels the gutter at the outer edges. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -t.spacing.xs }}>
              {gridDates.map((date) => {
                const open = (slotsByDate.get(date) ?? []).length;
                const isActive = date === activeDate;
                const label = isActive ? t.colors.onPrimary : open === 0 ? t.colors.inkFaint : t.colors.inkMuted;
                const numeral = isActive ? t.colors.onPrimary : open === 0 ? t.colors.inkFaint : t.colors.ink;
                return (
                  <View key={date} style={{ width: "33.333%", padding: t.spacing.xs }}>
                    <Pressable
                      testID={`day-${date}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive, disabled: open === 0 }}
                      accessibilityLabel={
                        open === 0
                          ? `${weekdayOf(date)} ${dayNumOf(date)}, no times available`
                          : `${weekdayOf(date)} ${dayNumOf(date)}, ${open} times available`
                      }
                      disabled={open === 0}
                      onPress={() => {
                        setPicked(date);
                        setPickedSlotKey(null);
                      }}
                      style={({ pressed }) => [
                        {
                          paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.md,
                          gap: t.spacing.xs,
                          borderRadius: t.radii.md,
                          backgroundColor: isActive ? t.colors.primary : t.colors.surfaceSoft,
                        },
                        pressed && open > 0 ? { opacity: t.motion.pressOpacity } : null,
                      ]}
                    >
                      <Text style={[t.text("label"), { color: label }]}>{weekdayOf(date)}</Text>
                      <Text style={[t.text("h1"), { color: numeral }]}>{dayNumOf(date)}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {active && (
          <View style={{ gap: t.spacing.sm }} testID="times-for-day">
            {active.slots.map((s) => {
              const key = `${s.bayId}|${s.start}`;
              const selected = selectedKey === key;
              // While a hold is live every other time is unreachable — dim them so
              // that reads as state rather than as an unresponsive tap.
              const dimmed = locked && !selected;
              const part = partOfDay(s.start);
              return (
                <Card
                  key={key}
                  testID={`slot-${s.start}`}
                  disabled={locked}
                  accessibilityState={{ selected, disabled: locked }}
                  accessibilityLabel={`${manilaTime(s.start)} to ${manilaTime(s.end)}, ${durationOf(s.start, s.end)}`}
                  onPress={() => setPickedSlotKey(key)}
                  style={{
                    gap: t.spacing.sm,
                    borderWidth: selected ? t.borders.control : t.borders.hairline,
                    borderColor: selected ? t.colors.primary : t.colors.lineSoft,
                    backgroundColor: selected ? t.colors.primarySoft : t.colors.surface,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm }}>
                    <Text style={[t.text("code"), { color: t.colors.ink }]}>
                      {manilaTime(s.start)} – {manilaTime(s.end)}
                    </Text>
                    <Text style={[t.text("code"), { color: t.colors.inkMuted }]}>
                      {durationOf(s.start, s.end)}
                    </Text>
                  </View>

                  {/* Neutral, not brand-tinted: the red on this screen is spent
                      on the chosen date, the chosen time and the CTA. */}
                  <View
                    style={{
                      alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
                      backgroundColor: selected ? t.colors.surface : t.colors.surfaceSunken,
                      borderRadius: t.radii.pill, paddingHorizontal: 10, paddingVertical: 4,
                    }}
                  >
                    <Icon name={PART_ICON[part]} size={16} color={t.colors.inkMuted} />
                    <Text style={[t.text("label", 600), { color: t.colors.inkMuted, letterSpacing: 1 }]}>{part}</Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* The commit sits outside the scroller so it stays reachable however long
          the day's list runs. */}
      {days.length > 0 && !locked && (
        <View style={{ padding: t.spacing.lg, paddingTop: t.spacing.sm }}>
          <Button
            block
            testID="review-booking"
            disabled={!selectedSlot}
            onPress={() => selectedSlot && onPick(selectedSlot)}
          >
            Review booking
          </Button>
        </View>
      )}
    </View>
  );
}
