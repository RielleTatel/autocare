import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";
import { fuelTypes, transmissions, Vehicle } from "@autocare/contracts";
import { ApiError } from "@autocare/api-client";
import { emptyVehicleForm, validateVehicleForm, VehicleFormState } from "./vehicleForm";

function FieldLabel({ children }: { children: string }) {
  return <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.md }]}>{children}</Text>;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <Text style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.xs }]}>{children}</Text>;
}

function TextField({ name, value, onChangeText, error, placeholder, keyboardType, autoCapitalize, mono }:
  { name: string; value: string; onChangeText: (t: string) => void; error?: string; placeholder?: string;
    keyboardType?: "default" | "number-pad"; autoCapitalize?: "none" | "characters"; mono?: boolean }) {
  return (
    <View>
      <TextInput
        testID={"field-" + name}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        style={[theme.text("body"), mono ? { fontFamily: "IBMPlexMono_500Medium" } : null,
          { backgroundColor: theme.colors.surface, borderRadius: theme.radii.sm, height: theme.minTarget,
            paddingHorizontal: theme.spacing.sm, borderWidth: 1, borderColor: error ? theme.colors.danger : theme.colors.line }]}
      />
      <FieldError>{error}</FieldError>
    </View>
  );
}

function PillRow({ name, options, value, onChange }:
  { name: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            testID={`field-${name}-${opt}`}
            onPress={() => onChange(opt)}
            style={{
              minHeight: theme.minTarget,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.line,
            }}
          >
            <Text style={[theme.text("body"), { color: selected ? theme.colors.onPrimary : theme.colors.ink }]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AddVehicleScreen({ onCreated, createVehicle }:
  { onCreated: (vehicle: Vehicle) => void; createVehicle: (data: any) => Promise<Vehicle> }) {
  const [form, setForm] = useState<VehicleFormState>(emptyVehicleForm);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormState, string>>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof VehicleFormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const result = validateVehicleForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const vehicle = await createVehicle(result.data);
      onCreated(vehicle);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PLATE_ALREADY_REGISTERED") {
        setErrors({ plateNo: "This plate is already registered — contact support if it's yours" });
      } else {
        setErrors({ plateNo: e instanceof Error ? e.message : "Something went wrong. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Add your vehicle</Text>

      <FieldLabel>Plate number</FieldLabel>
      <TextField name="plateNo" value={form.plateNo} onChangeText={set("plateNo")}
        placeholder="ABA 1234" autoCapitalize="characters" mono error={errors.plateNo} />

      <FieldLabel>Make</FieldLabel>
      <TextField name="make" value={form.make} onChangeText={set("make")} placeholder="Toyota" error={errors.make} />

      <FieldLabel>Model</FieldLabel>
      <TextField name="model" value={form.model} onChangeText={set("model")} placeholder="Vios" error={errors.model} />

      <FieldLabel>Year</FieldLabel>
      <TextField name="year" value={form.year} onChangeText={set("year")} placeholder="2019"
        keyboardType="number-pad" error={errors.year} />

      <FieldLabel>Odometer (km)</FieldLabel>
      <TextField name="odometerKm" value={form.odometerKm} onChangeText={set("odometerKm")} placeholder="42000"
        keyboardType="number-pad" error={errors.odometerKm} />

      <FieldLabel>Fuel type</FieldLabel>
      <PillRow name="fuelType" options={fuelTypes} value={form.fuelType} onChange={set("fuelType")} />

      <FieldLabel>Transmission</FieldLabel>
      <PillRow name="transmission" options={transmissions} value={form.transmission} onChange={set("transmission")} />

      <Pressable testID="more-details-toggle" onPress={() => setMoreOpen((o) => !o)}
        style={{ height: theme.minTarget, justifyContent: "center", marginTop: theme.spacing.md }}>
        <Text style={[theme.text("body"), { color: theme.colors.primary }]}>
          {moreOpen ? "Hide more details" : "More details"}
        </Text>
      </Pressable>

      {moreOpen && (
        <View>
          <FieldLabel>Variant</FieldLabel>
          <TextField name="variant" value={form.variant} onChangeText={set("variant")} error={errors.variant} />
          <FieldLabel>Engine (cc)</FieldLabel>
          <TextField name="engineCc" value={form.engineCc} onChangeText={set("engineCc")}
            keyboardType="number-pad" error={errors.engineCc} />
          <FieldLabel>Color</FieldLabel>
          <TextField name="color" value={form.color} onChangeText={set("color")} error={errors.color} />
          <FieldLabel>VIN</FieldLabel>
          <TextField name="vin" value={form.vin} onChangeText={set("vin")} autoCapitalize="characters" mono error={errors.vin} />
        </View>
      )}

      <Pressable testID="submit" disabled={submitting} onPress={handleSubmit}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.lg,
          backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Add vehicle</Text>
      </Pressable>
    </ScrollView>
  );
}
