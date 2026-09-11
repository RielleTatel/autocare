import { View, Text, Pressable, ScrollView } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { serviceIcon, serviceTint } from "./serviceIcon";
import type { MemberAppointment } from "./bookingApi";

const manilaDay = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", day: "2-digit" });
const manilaMonth = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short" }).toUpperCase();
const manilaDate = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
const manilaClock = (iso: string) =>
  new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

const CANCELLABLE = new Set(["BOOKED", "CONFIRMED"]);

/** Lifecycle → soft tinted tag. Mirrors the staff board's tone mapping so one
 *  status never reads two ways, using the -soft tokens (2026 re-skin) instead
 *  of a solid fill for this list's calmer, editorial density. */
const STATUS_TAG: Record<string, { bg: string; fg: string }> = {
  BOOKED: { bg: theme.colors.chassis, fg: theme.colors.inkMuted },
  CONFIRMED: { bg: theme.vhsBands.EXCELLENT.soft, fg: theme.vhsBands.EXCELLENT.text },
  IN_PROGRESS: { bg: theme.colors.primarySoft, fg: theme.colors.primary },
  COMPLETED: { bg: theme.colors.chassis, fg: theme.colors.inkMuted },
  CANCELLED: { bg: theme.colors.primarySoft, fg: theme.colors.primary },
  NO_SHOW: { bg: theme.vhsBands.CRITICAL.soft, fg: theme.vhsBands.CRITICAL.text },
};

function Tag({ children }: { children: string }) {
  const look = STATUS_TAG[children] ?? STATUS_TAG.BOOKED;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: look.bg, borderRadius: theme.radii.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ ...theme.text("code"), fontSize: 10, letterSpacing: 0.8, color: look.fg }}>{children}</Text>
    </View>
  );
}

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

  const Row = ({ a, cancellable, dim }: { a: MemberAppointment; cancellable: boolean; dim?: boolean }) => {
    const vehicle = vehicleLabels?.[a.vehicleId];
    const service = serviceNames[a.serviceTypeId] ?? "Service";
    // Only the name is on hand here — the list is keyed by service-type id, not
    // code — which the keyword match handles.
    const glyph = serviceIcon("", service);
    return (
      <Card testID={`appt-${a.id}`} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md, opacity: dim ? 0.72 : 1 }}>
        <View
          style={{
            width: 58, height: 58, borderRadius: t.radii.md,
            backgroundColor: dim ? t.colors.chassis : t.colors.primarySoft,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={[t.text("h2"), { color: dim ? t.colors.inkMuted : t.colors.primary, lineHeight: 24 }]}>{manilaDay(a.scheduledStart)}</Text>
          <Text style={{ ...t.text("code"), fontSize: 10, letterSpacing: 0.8, color: dim ? t.colors.inkFaint : t.colors.primary, marginTop: 2 }}>{manilaMonth(a.scheduledStart)}</Text>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          {/* Service leads: it is what the member booked. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            {/* Muted on a past booking: the row is already dimmed, and a full
                colour glyph would be the brightest thing in a settled list. */}
            <Icon name={glyph} size={16} color={dim ? t.colors.inkFaint : serviceTint(glyph).fg} />
            <Text style={[t.text("h2"), { color: t.colors.ink, flex: 1 }]} numberOfLines={1}>
              {service}
            </Text>
          </View>
          <Text style={[t.text("label"), { color: t.colors.inkFaint }]}>
            {manilaDate(a.scheduledStart)} · {manilaClock(a.scheduledStart)}
          </Text>
          {vehicle ? (
            <Text testID={`appt-vehicle-${a.id}`} style={[t.text("label"), { color: t.colors.inkMuted }]}>
              {vehicle}
            </Text>
          ) : null}
          <Tag>{a.status.replace("_", " ")}</Tag>
        </View>

        {cancellable && (
          <Pressable
            testID={`cancel-${a.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ${serviceNames[a.serviceTypeId] ?? "service"}`}
            onPress={() => onCancel(a.id)}
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: t.radii.pill, borderWidth: t.borders.hairline, borderColor: t.colors.line, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="x" size={18} color={t.colors.inkMuted} />
          </Pressable>
        )}
      </Card>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }} testID="bookings-list-screen">
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ gap: 2 }}>
          <Text style={[t.text("h1"), { color: t.colors.ink }]}>My bookings</Text>
          <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{upcoming.length} upcoming {upcoming.length === 1 ? "visit" : "visits"}</Text>
        </View>
        <Pressable
          testID={upcoming.length === 0 && past.length === 0 ? undefined : "book-new"}
          accessibilityRole="button"
          accessibilityLabel="Book a new service"
          onPress={onBookNew}
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: t.radii.pill, backgroundColor: t.colors.ink, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="plus" size={20} color={t.colors.surface} />
        </Pressable>
      </View>

      {pendingApproval ? (
        <Card testID="pending-approval" accent={theme.colors.ember} interactive onPress={pendingApproval.onApprove} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: t.radii.sm, backgroundColor: theme.vhsBands.NEEDS_ATTENTION.soft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="triangle-alert" size={20} color={theme.vhsBands.NEEDS_ATTENTION.text} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[t.text("body"), { color: t.colors.ink }]}>{pendingApproval.label}</Text>
            <Text style={[t.text("label", 600), { color: t.colors.primary }]}>Approve your service</Text>
          </View>
          <Icon name="chevron-right" size={20} color={t.colors.inkMuted} />
        </Card>
      ) : null}

      {upcoming.length === 0 && past.length === 0 ? (
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
          {upcoming.length > 0 ? (
            <>
              <Text style={[t.text("label"), { color: t.colors.inkFaint, letterSpacing: 1, textTransform: "uppercase" }]}>Upcoming</Text>
              {upcoming.map((a) => (
                <Row key={a.id} a={a} cancellable={CANCELLABLE.has(a.status)} />
              ))}
            </>
          ) : null}

          {past.length > 0 && (
            <Text style={[t.text("label"), { color: t.colors.inkFaint, letterSpacing: 1, textTransform: "uppercase", marginTop: t.spacing.xs }]}>Past</Text>
          )}
          {past.map((a) => (
            <Row key={a.id} a={a} cancellable={false} dim />
          ))}
        </>
      )}
    </ScrollView>
  );
}
