import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { theme } from "../../theme";
import { Vehicle } from "@autocare/contracts";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

export function HomeScreen({ firstName, vehicle, onAddVehicle, onUpdateOdometer, onBookService, attentionSlot }: {
  firstName: string;
  vehicle: Vehicle | null;
  onAddVehicle: () => void;
  onUpdateOdometer: () => void;
  onBookService?: () => void;
  /** M-10 attention summary card, injected by the container. */
  attentionSlot?: ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>
        Magandang araw, {firstName}
      </Text>

      {attentionSlot ? <View style={{ marginTop: theme.spacing.lg }}>{attentionSlot}</View> : null}

      {vehicle ? (
        <Card style={{ marginTop: theme.spacing.lg }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: theme.colors.primaryDeep, borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.sm, paddingVertical: 4 }}>
            <Text style={[theme.text("code"), { color: theme.colors.onPrimary }]}>{vehicle.plateNo}</Text>
          </View>
          <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.sm }]}>
            {vehicle.currentOdometerKm.toLocaleString("en-US")} km
          </Text>
        </Card>
      ) : (
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginTop: theme.spacing.lg }]}>
          Add your first vehicle to get started.
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Button block testID="quick-add-vehicle" onPress={onAddVehicle}>Add vehicle</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button block variant="secondary" testID="quick-update-odometer" onPress={onUpdateOdometer}>Update odometer</Button>
        </View>
      </View>

      {vehicle && onBookService && (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button block variant="deep" testID="quick-book-service" onPress={onBookService}>Book a service</Button>
        </View>
      )}
    </View>
  );
}
