import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { Plate } from "../../components/Plate";
import { BandChip } from "../../components/BandChip";
import { ApiError } from "@autocare/api-client";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";

function SpecRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: theme.colors.line }}>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{label}</Text>
      <Text style={[mono ? theme.text("code") : theme.text("body"), { color: theme.colors.ink }]}>{value}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={[theme.text("label", 600), { color: theme.colors.inkMuted, letterSpacing: 0.5 }]}>
      {children.toUpperCase()}
    </Text>
  );
}

export function VehicleDetailScreen({ vehicle, health, onUpdateOdometer, onArchive, onArchived, onBack, onManageSubscription, onViewHealthScore }: {
  vehicle: Vehicle;
  /** Latest score, when the vehicle has been inspected. Absent is normal for a
   *  new vehicle and must not read as an error. */
  health?: { score: number; band: Band } | null;
  onUpdateOdometer: (km: number, justification?: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onArchived: () => void;
  onBack?: () => void;
  onManageSubscription?: () => void;
  onViewHealthScore?: () => void;
}) {
  const [editingOdo, setEditingOdo] = useState(false);
  const [odoValue, setOdoValue] = useState(String(vehicle.currentOdometerKm));
  const [justification, setJustification] = useState("");
  const [needsJustification, setNeedsJustification] = useState(false);
  const [odoError, setOdoError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const photo = vehicle.photoUrls[0];

  const submitOdometer = async () => {
    setOdoError(null);
    const km = Number(odoValue);
    try {
      await onUpdateOdometer(km, needsJustification ? justification : undefined);
      setEditingOdo(false);
      setNeedsJustification(false);
      setJustification("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ODOMETER_REGRESSION") {
        setNeedsJustification(true);
        setOdoError("This reading is lower than the last one — tell us why.");
      } else {
        setOdoError(e instanceof Error ? e.message : "Couldn't update odometer");
      }
    }
  };

  const confirmedArchive = async () => {
    await onArchive(vehicle.id);
    setConfirmArchive(false);
    onArchived();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: 200 }} />
      ) : (
        /* An empty frame should still say what belongs in it. A flat grey slab
           reads as something that failed to load. */
        <View
          testID="no-photo"
          style={{
            width: "100%", height: 200,
            backgroundColor: theme.colors.chassis,
            alignItems: "center", justifyContent: "center", gap: theme.spacing.xs,
            borderBottomWidth: 1, borderBottomColor: theme.colors.line,
          }}
        >
          <Icon name="car-front" size={44} color={theme.colors.inkMuted} />
          <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>No photo yet</Text>
        </View>
      )}

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {/* Identity: everything needed to recognise the car, in one card, so it
            is never assembled by scrolling. */}
        <Card testID="vehicle-identity" style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Plate variant="chip">{vehicle.plateNo}</Plate>
            <Pressable testID="overflow-menu" accessibilityRole="button" accessibilityLabel="Vehicle options"
              onPress={() => setMenuOpen((o) => !o)}
              style={{ width: theme.minTarget, height: theme.minTarget, alignItems: "center", justifyContent: "center" }}>
              <Icon name="ellipsis" size={20} color={theme.colors.inkMuted} />
            </Pressable>
          </View>

          <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text testID="identity-odometer" style={[theme.text("code"), { color: theme.colors.inkMuted }]}>
              {vehicle.currentOdometerKm.toLocaleString("en-US")} km
            </Text>
            {health ? <BandChip band={health.band} /> : null}
          </View>
        </Card>

        {menuOpen && (
          <Pressable testID="archive-action" onPress={() => { setMenuOpen(false); setConfirmArchive(true); }}
            style={{ height: theme.minTarget, justifyContent: "center" }}>
            <Text style={[theme.text("body"), { color: theme.colors.danger }]}>Archive vehicle</Text>
          </Pressable>
        )}

        {confirmArchive && (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
            marginTop: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line }}>
            <Text style={[theme.text("body"), { color: theme.colors.ink }]}>
              Archive this vehicle? Its history is kept.
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <Pressable testID="archive-cancel" onPress={() => setConfirmArchive(false)}
                style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
                <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable testID="archive-confirm" onPress={confirmedArchive}
                style={{ height: theme.minTarget, justifyContent: "center", paddingHorizontal: theme.spacing.md }}>
                <Text style={[theme.text("body", 600), { color: theme.colors.danger }]}>Archive</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ gap: theme.spacing.xs }}>
          <SectionLabel>Specifications</SectionLabel>
          <Card>
            <SpecRow label="Fuel" value={vehicle.fuelType} />
            <SpecRow label="Transmission" value={vehicle.transmission} />
            <SpecRow label="Variant" value={vehicle.variant ?? "—"} />
            <SpecRow label="VIN" value={vehicle.vin ?? "—"} mono last />
          </Card>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>Odometer</Text>
          {editingOdo ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <TextInput testID="odometer-input" keyboardType="number-pad" value={odoValue} onChangeText={setOdoValue}
                style={[theme.text("body"), { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.sm,
                  paddingHorizontal: theme.spacing.sm, height: theme.minTarget, minWidth: 100 }]} />
              <Pressable testID="odometer-save" onPress={submitOdometer}
                style={{ height: theme.minTarget, justifyContent: "center" }}>
                <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable testID="odometer-update" onPress={() => setEditingOdo(true)}
              style={{ height: theme.minTarget, justifyContent: "center" }}>
              <Text style={[theme.text("body"), { color: theme.colors.primary }]}>
                {vehicle.currentOdometerKm.toLocaleString("en-US")} km · Update
              </Text>
            </Pressable>
          )}
        </View>

        {needsJustification && (
          <View style={{ marginTop: theme.spacing.sm }}>
            <TextInput testID="odometer-justification" placeholder="Why is this reading lower? (e.g. odometer replaced)"
              value={justification} onChangeText={setJustification}
              style={[theme.text("body"), { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.sm,
                padding: theme.spacing.sm, minHeight: theme.minTarget }]} multiline />
            <Pressable testID="odometer-retry" onPress={submitOdometer}
              style={{ height: theme.minTarget, justifyContent: "center" }}>
              <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>Retry with justification</Text>
            </Pressable>
          </View>
        )}

        {odoError ? (
          <Text testID="odometer-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.xs }]}>
            {odoError}
          </Text>
        ) : null}

        {onViewHealthScore ? (
          <Card testID="view-health-score" interactive onPress={onViewHealthScore}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ gap: 2 }}>
              <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
              {health ? (
                <Text testID="health-summary" style={[theme.text("label"), { color: theme.colors.inkMuted }]}>
                  {health.score} / 100 · {theme.vhsBands[health.band].labelEn}
                </Text>
              ) : null}
            </View>
            <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>
              {health ? "View report →" : "View →"}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
              Coming with your first inspection
            </Text>
          </Card>
        )}

        {onManageSubscription ? (
          <Button block testID="manage-subscription" onPress={onManageSubscription}>
            Manage subscription
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}
