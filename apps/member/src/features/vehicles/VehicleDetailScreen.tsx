import { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { ApiError } from "@autocare/api-client";
import { Vehicle } from "@autocare/contracts";

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1, borderBottomColor: theme.colors.line }}>
      <Text style={[theme.text("label"), { color: theme.colors.inkMuted }]}>{label}</Text>
      <Text style={[mono ? theme.text("code") : theme.text("body"), { color: theme.colors.ink }]}>{value}</Text>
    </View>
  );
}

export function VehicleDetailScreen({ vehicle, onUpdateOdometer, onArchive, onArchived, onBack, onManageSubscription, onViewHealthScore }: {
  vehicle: Vehicle;
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
        <View style={{ width: "100%", height: 200, backgroundColor: theme.colors.line }} />
      )}

      <View style={{ padding: theme.spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ backgroundColor: theme.colors.primaryDeep, borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.sm, paddingVertical: 4 }}>
            <Text style={[theme.text("code"), { color: theme.colors.onPrimary }]}>{vehicle.plateNo}</Text>
          </View>
          <Pressable testID="overflow-menu" onPress={() => setMenuOpen((o) => !o)}
            style={{ width: theme.minTarget, height: theme.minTarget, alignItems: "center", justifyContent: "center" }}>
            <Text style={[theme.text("h2"), { color: theme.colors.inkMuted }]}>{"⋯"}</Text>
          </Pressable>
        </View>

        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep, marginTop: theme.spacing.sm }]}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>

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

        <View style={{ marginTop: theme.spacing.lg }}>
          <SpecRow label="Fuel" value={vehicle.fuelType} />
          <SpecRow label="Transmission" value={vehicle.transmission} />
          <SpecRow label="Variant" value={vehicle.variant ?? "—"} />
          <SpecRow label="VIN" value={vehicle.vin ?? "—"} mono />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.line }}>
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
          <Pressable testID="view-health-score" onPress={onViewHealthScore}
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
              marginTop: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
            <Text style={[theme.text("h2"), { color: theme.colors.primary }]}>View →</Text>
          </Pressable>
        ) : (
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
            marginTop: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.line }}>
            <Text style={[theme.text("h2"), { color: theme.colors.ink }]}>Health Score</Text>
            <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.xs }]}>
              Coming with your first inspection
            </Text>
          </View>
        )}

        {onManageSubscription ? (
          <Pressable testID="manage-subscription" onPress={onManageSubscription}
            style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
              backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={[theme.text("body", 600), { color: theme.colors.onPrimary }]}>Manage subscription</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
