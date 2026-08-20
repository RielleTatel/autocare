import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";

function formatKm(km: number) {
  return `${km.toLocaleString("en-US")} km`;
}

function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress: () => void }) {
  return (
    <Pressable testID={`vehicle-${vehicle.id}`} onPress={onPress}
      style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md,
        marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.line }}>
      <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.primaryDeep, borderRadius: theme.radii.sm,
        paddingHorizontal: theme.spacing.sm, paddingVertical: 4 }}>
        <Text style={[theme.text("code"), { color: theme.colors.onPrimary }]}>{vehicle.plateNo}</Text>
      </View>
      <Text style={[theme.text("h2"), { color: theme.colors.ink, marginTop: theme.spacing.sm }]}>
        {vehicle.year} {vehicle.make} {vehicle.model}
      </Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>{formatKm(vehicle.currentOdometerKm)}</Text>
    </Pressable>
  );
}

export function VehiclesListScreen({ fetchVehicles, onSelectVehicle, onAddVehicle }: {
  fetchVehicles: () => Promise<Vehicle[]>;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchVehicles();
    setVehicles(list);
  }, [fetchVehicles]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis }}>
      <FlatList
        data={vehicles ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <VehicleCard vehicle={item} onPress={() => onSelectVehicle(item)} />}
        ListEmptyComponent={
          vehicles && vehicles.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: theme.spacing.xxl }}>
              <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
                No vehicles yet — add your first
              </Text>
              <Pressable testID="empty-add-vehicle" onPress={onAddVehicle}
                style={{ height: theme.minTarget, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radii.sm,
                  backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Add vehicle</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
      <Pressable testID="fab-add-vehicle" onPress={onAddVehicle}
        style={{ position: "absolute", right: theme.spacing.lg, bottom: theme.spacing.lg,
          width: theme.minTarget, height: theme.minTarget, borderRadius: theme.minTarget / 2,
          backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("h2"), { color: theme.colors.onPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}
