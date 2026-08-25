import type { ReactNode } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { BandChip } from "../../components/BandChip";
import { StarRating } from "../health-score/StarRating";

const logoMark = require("../../../assets/logo-mark.png");

export function HomeScreen({
  firstName, vehicle, planLabel, health, roadsideCallouts,
  onAddVehicle, onUpdateOdometer, onBookService, onOpenHealthScore, onRoadside, attentionSlot,
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
      </View>

      {attentionSlot ?? null}

      {vehicle ? (
        <Card pad="md" interactive onPress={onOpenHealthScore} style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: t.colors.primaryDeep, borderRadius: t.radii.sm,
              paddingHorizontal: t.spacing.sm, paddingVertical: 4 }}>
              <Text style={[t.text("code"), { color: t.colors.onPrimary }]}>{vehicle.plateNo}</Text>
            </View>
            {health ? <BandChip band={health.band} /> : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={[t.text("body"), { color: t.colors.ink }]}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            <Text style={[t.text("code"), { color: t.colors.inkMuted }]}>
              {vehicle.currentOdometerKm.toLocaleString("en-US")} km
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {health ? <StarRating score={health.score} band={health.band} size={18} /> : <View />}
            <Text style={[t.text("label"), { color: t.colors.primary, fontWeight: "600" }]}>
              {health ? `Health score ${health.score} ›` : "View health score ›"}
            </Text>
          </View>
        </Card>
      ) : (
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          Add your first vehicle to get started.
        </Text>
      )}

      <View style={{ gap: t.spacing.sm }}>
        {vehicle && onBookService ? (
          <Button block variant="deep" testID="quick-book-service" onPress={onBookService}>Book a service</Button>
        ) : null}
        <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button block variant="secondary" testID="quick-update-odometer" onPress={onUpdateOdometer}>Update odometer</Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button block variant="secondary" testID="quick-add-vehicle" onPress={onAddVehicle}>Add vehicle</Button>
          </View>
        </View>
      </View>

      {onRoadside ? (
        <Card accent={t.colors.danger} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
          <Text style={{ fontSize: 24, color: t.colors.danger }}>☎</Text>
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
