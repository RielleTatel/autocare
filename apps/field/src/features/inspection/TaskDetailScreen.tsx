import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { fieldTheme } from "../../theme";
import { api } from "../../shared/api";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { VehicleHistory } from "../history/VehicleHistory";

export type FieldVehicle = {
  id: string;
  plateNo: string;
  make: string;
  model: string;
  year: number;
  currentOdometerKm: number;
};

/** Confirm the booked vehicle and odometer. Vehicle browsing belongs to its
 * own screen: changing cars here would leave the original booking attached. */
export function TaskDetailScreen({ onStart, initialVehicleId, appointmentId, onBack, onOpenInspection }: {
  onStart(vehicle: FieldVehicle, odometerKm: number | null): void;
  initialVehicleId: string;
  appointmentId: string;
  onBack?: () => void;
  onOpenInspection?: (vehicleId: string, inspectionId: string) => void;
}) {
  const t = fieldTheme;
  const [vehicle, setVehicle] = useState<FieldVehicle | null>(null);
  const [odometer, setOdometer] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setVehicle(null);
    setErr(null);
    if (!initialVehicleId || !appointmentId) {
      setErr("Open a booking before starting its inspection.");
      return;
    }
    api.get<FieldVehicle>(`/vehicles/${encodeURIComponent(initialVehicleId)}`)
      .then((v) => {
        if (cancelled) return;
        if (v.id !== initialVehicleId) throw new Error("The vehicle does not match the booking. Reopen the booking and try again.");
        setVehicle(v);
        setOdometer(String(v.currentOdometerKm));
      })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load booked vehicle"); });
    return () => { cancelled = true; };
  }, [initialVehicleId, appointmentId, attempt]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Booking inspection" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        <View style={{ gap: t.spacing.xs }}>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Booking ID</Text>
          <Text selectable style={[t.text("code"), { color: t.colors.ink }]}>{appointmentId}</Text>
        </View>
        {err ? (
          <EmptyState tone="error" title="Could not load booked vehicle" body={err}
            action={<Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>Try again</Button>} />
        ) : !vehicle ? (
          <EmptyState tone="loading" title="Loading booked vehicle…" />
        ) : (
          <>
            <Card style={{ gap: t.spacing.xs }}>
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Booked vehicle</Text>
              <Text style={[t.text("h1"), { color: t.colors.ink }]}>{vehicle.plateNo}</Text>
              <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{vehicle.make} {vehicle.model} · {vehicle.year}</Text>
            </Card>
            <View style={{ gap: t.spacing.sm }}>
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Odometer (km)</Text>
              <TextInput accessibilityLabel="Odometer reading" keyboardType="number-pad" value={odometer} onChangeText={setOdometer}
                style={{ minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md, backgroundColor: t.colors.surface, paddingHorizontal: t.spacing.md, fontSize: 24, color: t.colors.ink }} />
              <Button accessibilityLabel="Begin 50-point inspection" onPress={() => onStart(vehicle, odometer.trim() === "" ? null : Number(odometer))}>
                Begin inspection
              </Button>
            </View>
            <VehicleHistory vehicleId={vehicle.id} onOpenInspection={onOpenInspection ? (id) => onOpenInspection(vehicle.id, id) : undefined} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
