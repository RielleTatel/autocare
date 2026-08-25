import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
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
  pendingApproval,
  onCancel,
  onBookNew,
}: {
  appointments: MemberAppointment[];
  serviceNames: Record<string, string>;
  now: Date;
  /** A work order awaiting the member's per-line decision (M-25), if any. */
  pendingApproval?: { label: string; onApprove: () => void };
  onCancel: (id: string) => void;
  onBookNew: () => void;
}) {
  const t = theme;
  const upcoming = appointments.filter((a) => new Date(a.scheduledStart) >= now && a.status !== "CANCELLED");
  const past = appointments.filter((a) => new Date(a.scheduledStart) < now || a.status === "CANCELLED");

  const Row = ({ a, cancellable }: { a: MemberAppointment; cancellable: boolean }) => (
    <Card testID={`appt-${a.id}`} style={{ gap: 4 }}>
      <Text style={[t.text("body"), { color: t.colors.ink }]}>{serviceNames[a.serviceTypeId] ?? "Service"}</Text>
      <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{manila(a.scheduledStart)} · {a.status.replace("_", " ")}</Text>
      {cancellable && (
        <Pressable testID={`cancel-${a.id}`} onPress={() => onCancel(a.id)} style={{ minHeight: t.minTarget, justifyContent: "center" }}>
          <Text style={[t.text("label"), { color: t.colors.danger }]}>Cancel</Text>
        </Pressable>
      )}
    </Card>
  );

  return (
    <ScrollView style={{ backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }} testID="bookings-list-screen">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>My bookings</Text>
        <Pressable testID="book-new" onPress={onBookNew} style={{ minHeight: t.minTarget, justifyContent: "center" }}>
          <Text style={[t.text("label"), { color: t.colors.primary }]}>Book new</Text>
        </Pressable>
      </View>

      {pendingApproval ? (
        <Card testID="pending-approval" accent={theme.vhsBands.NEEDS_ATTENTION.fill} interactive onPress={pendingApproval.onApprove} style={{ gap: 4 }}>
          <Text style={[t.text("body"), { color: t.colors.ink }]}>{pendingApproval.label}</Text>
          <Text style={[t.text("label"), { color: t.colors.primary }]}>Approve your service ›</Text>
        </Card>
      ) : null}

      <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Upcoming</Text>
      {upcoming.length === 0 && <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Nothing scheduled.</Text>}
      {upcoming.map((a) => (
        <Row key={a.id} a={a} cancellable={CANCELLABLE.has(a.status)} />
      ))}

      {past.length > 0 && <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Past</Text>}
      {past.map((a) => (
        <Row key={a.id} a={a} cancellable={false} />
      ))}
    </ScrollView>
  );
}
