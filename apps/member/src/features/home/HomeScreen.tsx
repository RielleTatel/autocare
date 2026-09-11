import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { VehicleCard } from "../../components/VehicleCard";
import { Icon, type IconName } from "../../components/Icon";

const logoMark = require("../../../assets/logo-mark.png");

/**
 * M-33 entry point, in the masthead rather than the Account tab: the feed is
 * something the member checks on arrival, so it has to be reachable without
 * first leaving Home.
 *
 * Deliberately compact. Home's one bold element is the attention card, and
 * service-due threads already surface there (attention sources SERVICE_DUE from
 * these same threads) — a second full-width card would say the same thing twice
 * and split the eye. The count is the whole payload; the feed carries the rest.
 *
 * Rendered even at zero unread. The entry point disappearing when the feed is
 * quiet is how a member learns the feed does not exist.
 */
function AnnouncementsBell({ unread, onPress }: { unread: number; onPress: () => void }) {
  const t = theme;
  // Three digits would push the badge wider than the bell it sits on.
  const label = unread > 9 ? "9+" : String(unread);

  return (
    <Pressable
      testID="home-announcements"
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Announcements, ${unread} unread` : "Announcements"
      }
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: t.minTarget,
          height: t.minTarget,
          borderRadius: t.radii.sm,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed ? { opacity: t.motion.pressOpacity } : null,
      ]}
    >
      <Icon name="bell" size={24} color={t.colors.primaryDeep} />
      {unread > 0 ? (
        <View
          testID="home-announcements-badge"
          // Sits on the bell's shoulder: the count belongs to the bell, and
          // anchoring it beside would widen the masthead as the number grows.
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            borderRadius: 9,
            backgroundColor: t.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            // Against the chassis grey the badge needs its own edge, or it
            // reads as part of the glyph at a glance.
            borderWidth: 2,
            borderColor: t.colors.chassis,
          }}
        >
          <Text style={[t.text("label"), { color: t.colors.onPrimary, lineHeight: 14 }]}>
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * A shortcut on Home: icon over label, in a tile sized to a third of the row.
 *
 * `primary` fills the tile in brand chrome for the one action the screen is
 * steering towards; the rest are quiet surfaces. Labels are the full action
 * name, not a shortened one — "Book a service" leads to a flow whose button
 * says the same thing, and renaming it here would break that chain.
 */
function ActionTile({
  icon, label, primary, onPress, testID,
}: {
  icon: IconName;
  label: string;
  primary?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const t = theme;
  const fg = primary ? t.colors.onPrimary : t.colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: t.minTarget,
          paddingVertical: t.spacing.md,
          paddingHorizontal: t.spacing.sm,
          gap: t.spacing.sm,
          alignItems: "center",
          borderRadius: t.radii.md,
          backgroundColor: primary ? t.colors.primaryDeep : t.colors.surface,
          borderWidth: primary ? 0 : t.borders.hairline,
          borderColor: t.colors.lineSoft,
        },
        pressed ? { opacity: t.motion.pressOpacity } : null,
      ]}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: t.radii.pill,
          backgroundColor: primary ? "rgba(255,255,255,0.16)" : t.colors.primarySoft,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} color={primary ? t.colors.onPrimary : t.colors.primary} />
      </View>
      <Text style={[t.text("label", 600), { color: fg, textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );
}

export function HomeScreen({
  firstName, vehicle, planLabel, health, roadsideCallouts,
  onAddVehicle, onUpdateOdometer, onBookService, onOpenHealthScore, onRoadside, attentionSlot,
  onAnnouncements, unreadAnnouncements = 0,
}: {
  firstName: string;
  vehicle: Vehicle | null;
  /** e.g. "Care Plus · next billing 15 Sep 2026" */
  planLabel?: string;
  /** Latest health score for the primary vehicle, if inspected. */
  health?: { score: number; band: Band } | null;
  roadsideCallouts?: number | null;
  onAddVehicle: () => void;
  onUpdateOdometer: () => void;
  onBookService?: () => void;
  onOpenHealthScore?: () => void;
  onRoadside?: () => void;
  /** M-10 attention summary card, injected by the container. */
  attentionSlot?: ReactNode;
  /** Opens the M-33 feed. Omit and the masthead bell is not rendered. */
  onAnnouncements?: () => void;
  /** Unread thread count for the masthead badge. */
  unreadAnnouncements?: number;
}) {
  const t = theme;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
    >
      {/* Masthead — logo + bilingual greeting + subscription line */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
        <Image source={logoMark} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={[t.text("h1"), { color: t.colors.primaryDeep }]}>Magandang araw, {firstName}</Text>
          {planLabel ? (
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{planLabel}</Text>
          ) : null}
        </View>
        {onAnnouncements ? (
          <AnnouncementsBell unread={unreadAnnouncements} onPress={onAnnouncements} />
        ) : null}
      </View>

      {attentionSlot ?? null}

      {vehicle ? (
        <VehicleCard testID="home-vehicle-card" vehicle={vehicle} health={health} onPress={onOpenHealthScore} />
      ) : (
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          Add your first vehicle to get started.
        </Text>
      )}

      {/* One compact row instead of a full-width button stacked over a pair —
          three equal tiles read as a set of shortcuts and cost roughly half the
          height the buttons did. */}
      <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
        {vehicle && onBookService ? (
          <ActionTile icon="calendar-plus" label="Book a service" primary testID="quick-book-service" onPress={onBookService} />
        ) : null}
        <ActionTile icon="gauge" label="Update odometer" testID="quick-update-odometer" onPress={onUpdateOdometer} />
        <ActionTile icon="plus" label="Add vehicle" testID="quick-add-vehicle" onPress={onAddVehicle} />
      </View>

      {onRoadside ? (
        <Card accent={t.colors.danger} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
          <Icon name="phone" size={24} color={t.colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>Roadside assistance</Text>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
              {roadsideCallouts != null ? `${roadsideCallouts} call-outs left this cycle` : "24/7 emergency help"}
            </Text>
          </View>
          <Button variant="danger" testID="quick-roadside" onPress={onRoadside}>Request</Button>
        </Card>
      ) : null}
    </ScrollView>
  );
}
