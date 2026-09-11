import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { fieldTheme } from "../../theme";
import { api } from "../../shared/api";
import { VehicleHistory } from "../history/VehicleHistory";

export type FieldVehicle = {
  id: string;
  plateNo: string;
  make: string;
  model: string;
  year: number;
  currentOdometerKm: number;
};

/** F-04 — task detail: pick the vehicle (browse the staff-visible fleet, or
 *  filter by plate), confirm odometer, start the 50-point inspection. */
export function TaskDetailScreen({
  onStart,
  initialVehicleId,
  onOpenInspection,
}: {
  onStart(vehicle: FieldVehicle, odometerKm: number | null): void;
  initialVehicleId?: string;
  /** Opens a past inspection for the selected vehicle. Passed down rather than
   *  taken from useNavigation: this screen is rendered inside InspectionFlow,
   *  which owns the stack entry, and the prop keeps it unit-testable. */
  onOpenInspection?: (vehicleId: string, inspectionId: string) => void;
}) {
  const t = fieldTheme;
  const [vehicles, setVehicles] = useState<FieldVehicle[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FieldVehicle | null>(null);
  const [odometer, setOdometer] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<FieldVehicle[]>("/vehicles")
      .then(setVehicles)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load vehicles"));
  }, []);

  // Coming from a tapped appointment: skip the plate search and land straight
  // on the odometer confirm step for that vehicle.
  useEffect(() => {
    if (!initialVehicleId || selected) return;
    const v = vehicles.find((x) => x.id === initialVehicleId);
    if (v) {
      setSelected(v);
      setQuery(v.plateNo);
      setOdometer(String(v.currentOdometerKm));
    }
  }, [initialVehicleId, vehicles, selected]);

  const matches = query.trim() === ""
    ? vehicles
    : vehicles.filter((v) => v.plateNo.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>Start inspection</Text>
      {err && <Text style={[t.text("body"), { color: t.colors.danger }]}>{err}</Text>}

      <TextInput
        accessibilityLabel="Search plate number"
        value={query}
        onChangeText={(q) => { setQuery(q); setSelected(null); }}
        placeholder="Plate number…"
        autoCapitalize="characters"
        style={{ minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md, backgroundColor: t.colors.surface, paddingHorizontal: t.spacing.md, fontSize: 20, color: t.colors.ink }}
      />
      {matches.map((v) => (
        <Pressable
          key={v.id}
          accessibilityRole="button"
          accessibilityLabel={`Select ${v.plateNo}`}
          onPress={() => { setSelected(v); setQuery(v.plateNo); setOdometer(String(v.currentOdometerKm)); }}
          style={{ minHeight: t.minTarget, justifyContent: "center", backgroundColor: selected?.id === v.id ? t.colors.primary : t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, paddingHorizontal: t.spacing.md }}
        >
          <Text style={[t.text("h2"), { color: selected?.id === v.id ? "#FFFFFF" : t.colors.ink }]}>
            {v.plateNo} — {v.make} {v.model} {v.year}
          </Text>
        </Pressable>
      ))}

      {selected && (
        <View style={{ gap: t.spacing.sm }}>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Odometer (km)</Text>
          <TextInput
            accessibilityLabel="Odometer reading"
            keyboardType="number-pad"
            value={odometer}
            onChangeText={setOdometer}
            style={{ minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md, backgroundColor: t.colors.surface, paddingHorizontal: t.spacing.md, fontSize: 24, color: t.colors.ink }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Begin 50-point inspection"
            onPress={() => onStart(selected, odometer.trim() === "" ? null : Number(odometer))}
            style={{ minHeight: t.minTarget, borderRadius: t.radii.md, backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Begin inspection</Text>
          </Pressable>

          <VehicleHistory
            vehicleId={selected.id}
            onOpenInspection={onOpenInspection ? (id) => onOpenInspection(selected.id, id) : undefined}
          />
        </View>
      )}
    </ScrollView>
  );
}
