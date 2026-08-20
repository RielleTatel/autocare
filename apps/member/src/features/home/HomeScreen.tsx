import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";

export function HomeScreen({ firstName, vehicle, onAddVehicle, onUpdateOdometer }: {
  firstName: string;
  vehicle: Vehicle | null;
  onAddVehicle: () => void;
  onUpdateOdometer: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>
        Magandang araw, {firstName}
      </Text>

      {vehicle ? (
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
          marginTop: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.line }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.primaryDeep, borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.sm, paddingVertical: 4 }}>
            <Text style={[theme.text("code"), { color: theme.colors.onPrimary }]}>{vehicle.plateNo}</Text>
          </View>
          <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
            {vehicle.currentOdometerKm.toLocaleString("en-US")} km
          </Text>
        </View>
      ) : (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.lg }]}>
          Add your first vehicle to get started.
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <Pressable testID="quick-add-vehicle" onPress={onAddVehicle}
          style={{ flex: 1, height: theme.minTarget, borderRadius: theme.radii.sm, backgroundColor: theme.colors.primary,
            alignItems: "center", justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Add vehicle</Text>
        </Pressable>
        <Pressable testID="quick-update-odometer" onPress={onUpdateOdometer}
          style={{ flex: 1, height: theme.minTarget, borderRadius: theme.radii.sm, borderWidth: 1,
            borderColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Text style={[theme.text("body"), { color: theme.colors.primary, fontWeight: "600" }]}>Update odometer</Text>
        </Pressable>
      </View>
    </View>
  );
}
