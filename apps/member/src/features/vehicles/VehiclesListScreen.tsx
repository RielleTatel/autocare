import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { BandChip } from "../../components/BandChip";
import { StarRating } from "../health-score/StarRating";
import { Icon } from "../../components/Icon";
import { Plate } from "../../components/Plate";

/** Leading tile on each vehicle row — DS card-leading size on a chassis swatch. */
function CarIcon() {
  return (
    <View style={{ width: 46, height: 46, borderRadius: theme.radii.sm, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
      <Icon name="car-front" size={24} color={theme.colors.inkMuted} />
    </View>
  );
}

function VehicleRow({ vehicle, health, onPress }: {
  vehicle: Vehicle;
  health: { score: number; band: Band } | null;
  onPress: () => void;
}) {
  const t = theme;
  return (
    <Card interactive onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md, marginBottom: t.spacing.sm }}>
      <CarIcon />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Plate variant="plain">{vehicle.plateNo}</Plate>
        <Text style={[t.text("body"), { color: t.colors.ink }]} numberOfLines={1}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{vehicle.currentOdometerKm.toLocaleString("en-US")} km</Text>
      </View>
      {health ? (
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <BandChip band={health.band} />
          <StarRating score={health.score} band={health.band} size={14} />
        </View>
      ) : null}
    </Card>
  );
}

export function VehiclesListScreen({ fetchVehicles, fetchHealth, onSelectVehicle, onAddVehicle }: {
  fetchVehicles: () => Promise<Vehicle[]>;
  /** Optional per-vehicle latest health score, for the band + stars. */
  fetchHealth?: (vehicleId: string) => Promise<{ score: number; band: Band } | null>;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [health, setHealth] = useState<Record<string, { score: number; band: Band }>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchVehicles();
    setVehicles(list);
    if (fetchHealth) {
      for (const v of list) {
        fetchHealth(v.id).then((h) => { if (h) setHealth((prev) => ({ ...prev, [v.id]: h })); }).catch(() => undefined);
      }
    }
  }, [fetchVehicles, fetchHealth]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const t = theme;
  const count = vehicles?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FlatList
        data={vehicles ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: t.spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={{ marginBottom: t.spacing.sm }}>
            <Text style={[t.text("h1"), { color: t.colors.ink }]}>My vehicles</Text>
            {vehicles ? (
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
                {count} {count === 1 ? "vehicle" : "vehicles"}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <VehicleRow vehicle={item} health={health[item.id] ?? null} onPress={() => onSelectVehicle(item)} />
        )}
        ListFooterComponent={
          vehicles ? (
            <View style={{ marginTop: t.spacing.sm }}>
              <Button block variant="secondary" icon="plus" testID="add-vehicle" onPress={onAddVehicle}>Add vehicle</Button>
            </View>
          ) : null
        }
        ListEmptyComponent={
          vehicles && vehicles.length === 0 ? (
            <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.xl }]}>
              No vehicles yet — add your first below.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
