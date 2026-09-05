import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import type { MemberAppointment } from "./bookingApi";

const manilaDate = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
const manilaClock = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

const CANCELLABLE = new Set(["BOOKED", "CONFIRMED"]);

type Tone = "neutral" | "info" | "success" | "warn" | "danger";

/** Lifecycle → pill tone. Mirrors the staff board so one status never reads two ways. */
const STATUS_TONE: Record<string, Tone> = {
  BOOKED: "info",
  CONFIRMED: "info",
  IN_PROGRESS: "warn",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

/**
 * M-23 — my bookings, split upcoming/past. Cancel is offered on cancellable upcoming appointments;
 * the API enforces the 24h/entitlement-refund rules. Presentational only.
 */
export function BookingsListScreen({
  appointments,
  serviceNames,
  vehicleLabels,
  now,
  pendingApproval,
  onCancel,
  onBookNew,
}: {
  appointments: MemberAppointment[];
  serviceNames: Record<string, string>;
  /** vehicleId → "2020 Toyota Vios". Optional: without it the row simply omits
   *  the vehicle line rather than showing a raw id. */
  vehicleLabels?: Record<string, string>;
  now: Date;
  /** A work order awaiting the member's per-line decision (M-25), if any. */
  pendingApproval?: { label: string; onApprove: () => void };
  onCancel: (id: string) => void;
  onBookNew: () => void;
}) {
  const t = theme;
  const upcoming = appointments.filter((a) => new Date(a.scheduledStart) >= now && a.status !== "CANCELLED");
  const past = appointments.filter((a) => new Date(a.scheduledStart) < now || a.status === "CANCELLED");

  const Row = ({ a, cancellable }: { a: MemberAppointment; cancellable: boolean }) => {
    const vehicle = vehicleLabels?.[a.vehicleId];
    return (
      <Card testID={`appt-${a.id}`} style={{ gap: t.spacing.xs }}>
        {/* Service leads: it is what the member booked. Status sits opposite so
            the pair reads as one line without competing for the same weight. */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm }}>
          <Text style={[t.text("h2"), { color: t.colors.ink, flex: 1 }]} numberOfLines={1}>
            {serviceNames[a.serviceTypeId] ?? "Service"}
          </Text>
          <StatusPill tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace("_", " ")}</StatusPill>
        </View>

        <Text style={[t.text("body"), { color: t.colors.ink }]}>
          {manilaDate(a.scheduledStart)} · {manilaClock(a.scheduledStart)}
        </Text>

        {vehicle ? (
          <Text testID={`appt-vehicle-${a.id}`} style={[t.text("label"), { color: t.colors.inkMuted }]}>
            {vehicle}
          </Text>
        ) : null}

        {cancellable && (
          <Pressable
            testID={`cancel-${a.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ${serviceNames[a.serviceTypeId] ?? "service"}`}
            onPress={() => onCancel(a.id)}
            style={{ minHeight: t.minTarget, justifyContent: "center" }}
          >
            <Text style={[t.text("label", 600), { color: t.colors.danger }]}>Cancel booking</Text>
          </Pressable>
        )}
      </Card>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }} testID="bookings-list-screen">
      <Text style={[t.text("h1"), { color: t.colors.primaryDeep }]}>My bookings</Text>

      {pendingApproval ? (
        <Card testID="pending-approval" accent={theme.vhsBands.NEEDS_ATTENTION.fill} interactive onPress={pendingApproval.onApprove} style={{ gap: 4 }}>
          <Text style={[t.text("body"), { color: t.colors.ink }]}>{pendingApproval.label}</Text>
          <Text style={[t.text("label", 600), { color: t.colors.primary }]}>Approve your service ›</Text>
        </Card>
      ) : null}

      {upcoming.length === 0 ? (
        /* An empty list is the moment to offer the next step, not to report a
           void. The CTA is the screen's purpose, so it leads here. */
        <Card pad="lg" testID="bookings-empty">
          <View style={{ alignItems: "center", gap: t.spacing.md }}>
            <View
              style={{
                width: 88, height: 88, borderRadius: 44,
                backgroundColor: t.colors.chassis,
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="calendar-days" size={40} color={t.colors.primaryDeep} />
            </View>
            <View style={{ gap: t.spacing.xs }}>
              <Text style={[t.text("h2"), { color: t.colors.ink, textAlign: "center" }]}>No upcoming services</Text>
              <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center" }]}>
                Book a service and it will show up here with its date, time, and status.
              </Text>
            </View>
            <Button block testID="book-new" onPress={onBookNew}>Book a service</Button>
          </View>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Upcoming</Text>
            <Button variant="secondary" testID="book-new" onPress={onBookNew}>Book a service</Button>
          </View>
          {upcoming.map((a) => (
            <Row key={a.id} a={a} cancellable={CANCELLABLE.has(a.status)} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <Text style={[t.text("label"), { color: t.colors.inkMuted, marginTop: t.spacing.sm }]}>Past</Text>
      )}
      {past.map((a) => (
        <Row key={a.id} a={a} cancellable={false} />
      ))}
    </ScrollView>
  );
}
