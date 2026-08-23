import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import type { MemberAppointment } from "./bookingApi";

const manila = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

const CANCELLABLE = new Set(["BOOKED", "CONFIRMED"]);

/**
 * M-23 — my bookings, split upcoming/past. Cancel is offered on cancellable upcoming appointments;
 * the API enforces the 24h/entitlement-refund rules. Presentational only.
 */
export function BookingsListScreen({
  appointments,
  serviceNames,
  now,
  onCancel,
  onBookNew,
}: {
  appointments: MemberAppointment[];
  serviceNames: Record<string, string>;
  now: Date;
  onCancel: (id: string) => void;
  onBookNew: () => void;
}) {
  const upcoming = appointments.filter((a) => new Date(a.scheduledStart) >= now && a.status !== "CANCELLED");
  const past = appointments.filter((a) => new Date(a.scheduledStart) < now || a.status === "CANCELLED");

  const Card = ({ a, cancellable }: { a: MemberAppointment; cancellable: boolean }) => (
    <View
      key={a.id}
      testID={`appt-${a.id}`}
      style={{ borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.md, padding: theme.spacing.md, gap: 4, backgroundColor: theme.colors.surface }}
    >
      <Text style={[theme.text("body"), { color: theme.colors.ink }]}>{serviceNames[a.serviceTypeId] ?? "Service"}</Text>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{manila(a.scheduledStart)} · {a.status.replace("_", " ")}</Text>
      {cancellable && (
        <Pressable testID={`cancel-${a.id}`} onPress={() => onCancel(a.id)} style={{ minHeight: theme.minTarget, justifyContent: "center" }}>
          <Text style={[theme.text("label"), { color: theme.colors.danger }]}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }} testID="bookings-list-screen">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>My bookings</Text>
        <Pressable testID="book-new" onPress={onBookNew} style={{ minHeight: theme.minTarget, justifyContent: "center" }}>
          <Text style={[theme.text("label"), { color: theme.colors.primary }]}>Book new</Text>
        </Pressable>
      </View>

      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Upcoming</Text>
      {upcoming.length === 0 && <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Nothing scheduled.</Text>}
      {upcoming.map((a) => (
        <Card key={a.id} a={a} cancellable={CANCELLABLE.has(a.status)} />
      ))}

      {past.length > 0 && <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Past</Text>}
      {past.map((a) => (
        <Card key={a.id} a={a} cancellable={false} />
      ))}
    </ScrollView>
  );
}
