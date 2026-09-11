import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";
import type { Band } from "@autocare/scoring";
import { Button } from "../../components/Button";
import { VehicleCard } from "../../components/VehicleCard";

export function VehiclesListScreen({ fetchVehicles, fetchHealth, onSelectVehicle, onAddVehicle }: {
  fetchVehicles: () => Promise<Vehicle[]>;
  /** Optional per-vehicle latest health score, for the band + stars. */
  fetchHealth?: (vehicleId: string) => Promise<{ score: number; band: Band } | null>;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [health, setHealth] = useState<Record<string, { score: number; band: Band }>>({});
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const list = await fetchVehicles();
    setVehicles(list);
    if (fetchHealth) {
      for (const v of list) {
        fetchHealth(v.id).then((h) => { if (h) setHealth((prev) => ({ ...prev, [v.id]: h })); }).catch(() => undefined);
      }
    }
  }, [fetchVehicles, fetchHealth]);

  // The rejection has to be handled here: an async call fired from useEffect
  // with nothing attached becomes an unhandled rejection, which RN surfaces as
  // a red uncaught-error box — and the list sits empty for ever.
  useEffect(() => { load().catch(() => setFailed(true)); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await load(); } catch { setFailed(true); } finally { setRefreshing(false); }
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
          <VehicleCard
            testID={`vehicle-${item.id}`}
            vehicle={item}
            health={health[item.id] ?? null}
            onPress={() => onSelectVehicle(item)}
            style={{ marginBottom: theme.spacing.sm }}
          />
        )}
        ListFooterComponent={
          vehicles ? (
            <View style={{ marginTop: t.spacing.sm }}>
              <Button block variant="secondary" icon="plus" testID="add-vehicle" onPress={onAddVehicle}>Add vehicle</Button>
            </View>
          ) : null
        }
        ListEmptyComponent={
          failed ? (
            <View style={{ alignItems: "center", gap: t.spacing.md, marginTop: t.spacing.xl }}>
              <Text style={[t.text("body"), { color: t.colors.ink, textAlign: "center" }]}>
                Couldn't load your vehicles. Check your connection and try again.
              </Text>
              <Button testID="vehicles-retry" variant="secondary" onPress={() => void load().catch(() => setFailed(true))}>
                Try again
              </Button>
            </View>
          ) : vehicles && vehicles.length === 0 ? (
            <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.xl }]}>
              No vehicles yet — add your first below.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
