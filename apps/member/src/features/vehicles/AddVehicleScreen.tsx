import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { theme, familyForRole } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { Plate } from "../../components/Plate";
import { fuelTypes, transmissions, Vehicle } from "@autocare/contracts";
import { ApiError } from "@autocare/api-client";
import { emptyVehicleForm, validateVehicleForm, VehicleFormState } from "./vehicleForm";

function FieldLabel({ children }: { children: string }) {
  return <Text style={[theme.text("label"), { color: theme.colors.inkMuted, marginTop: theme.spacing.md }]}>{children}</Text>;
}

/** A group of related fields. The heading says what this part of the form is
 *  about, so seven inputs read as three decisions rather than one long list. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={[theme.text("label", 600), { color: theme.colors.inkMuted, letterSpacing: 0.5 }]}>
        {title.toUpperCase()}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

/**
 * The car taking shape as it is described. Held back until the plate and make
 * exist, because an empty frame promises something the form has not earned yet.
 */
function VehiclePreview({ form }: { form: VehicleFormState }) {
  const t = theme;
  if (!form.plateNo.trim() || !form.make.trim()) return null;
  const name = [form.year.trim(), form.make.trim(), form.model.trim()].filter(Boolean).join(" ");
  const odo = form.odometerKm.trim();
  return (
    <View style={{ gap: t.spacing.xs }} testID="vehicle-preview">
      <Text style={[t.text("label", 600), { color: t.colors.inkMuted, letterSpacing: 0.5 }]}>YOUR VEHICLE</Text>
      <Card pad="lg" style={{ gap: t.spacing.sm, alignItems: "center" }}>
        <Plate variant="chip">{form.plateNo.trim().toUpperCase()}</Plate>
        <Text style={[t.text("h2"), { color: t.colors.ink, textAlign: "center" }]}>{name}</Text>
        {odo ? (
          <Text style={[t.text("code"), { color: t.colors.inkMuted }]}>
            {Number(odo).toLocaleString("en-US")} km
          </Text>
        ) : null}
      </Card>
    </View>
  );
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
        style={[theme.text("body"), mono ? { fontFamily: familyForRole("code") } : null,
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
  const [formError, setFormError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof VehicleFormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const result = validateVehicleForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      setFormError(null);
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const vehicle = await createVehicle(result.data);
      onCreated(vehicle);
    } catch (e) {
      // Only field-specific ApiError codes get attributed to a field (e.g. the
      // plate). Everything else (network errors, unknown codes) is a general
      // failure, not a plate problem — mis-attributing it there was misleading.
      if (e instanceof ApiError && e.code === "PLATE_ALREADY_REGISTERED") {
        setErrors({ plateNo: "This plate is already registered — contact support if it's yours" });
      } else {
        setFormError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.chassis }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ gap: 4 }}>
        <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Add your vehicle</Text>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Tell us about your car.</Text>
      </View>

      <Section title="Vehicle">
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
      </Section>

      <Section title="Usage">
        <FieldLabel>Odometer (km)</FieldLabel>
        <TextField name="odometerKm" value={form.odometerKm} onChangeText={set("odometerKm")} placeholder="42000"
          keyboardType="number-pad" error={errors.odometerKm} />

        <FieldLabel>Fuel type</FieldLabel>
        <PillRow name="fuelType" options={fuelTypes} value={form.fuelType} onChange={set("fuelType")} />
      </Section>

      <Section title="Transmission">
        <FieldLabel>Transmission</FieldLabel>
        <PillRow name="transmission" options={transmissions} value={form.transmission} onChange={set("transmission")} />
      </Section>

      <VehiclePreview form={form} />

      <Pressable testID="more-details-toggle" onPress={() => setMoreOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        style={{ minHeight: theme.minTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[theme.text("body", 600), { color: theme.colors.primary }]}>Vehicle details</Text>
        <Icon name={moreOpen ? "chevron-left" : "chevron-right"} size={20} color={theme.colors.primary} />
      </Pressable>

      {moreOpen && (
        <Card>
          <FieldLabel>Variant</FieldLabel>
          <TextField name="variant" value={form.variant} onChangeText={set("variant")} error={errors.variant} />
          <FieldLabel>Engine (cc)</FieldLabel>
          <TextField name="engineCc" value={form.engineCc} onChangeText={set("engineCc")}
            keyboardType="number-pad" error={errors.engineCc} />
          <FieldLabel>Color</FieldLabel>
          <TextField name="color" value={form.color} onChangeText={set("color")} error={errors.color} />
          <FieldLabel>VIN</FieldLabel>
          <TextField name="vin" value={form.vin} onChangeText={set("vin")} autoCapitalize="characters" mono error={errors.vin} />
        </Card>
      )}

      {formError ? (
        <Text testID="form-error" style={[theme.text("label"), { color: theme.colors.danger, marginTop: theme.spacing.md }]}>
          {formError}
        </Text>
      ) : null}

      <Button block testID="submit" disabled={submitting} onPress={handleSubmit}>
        Add vehicle
      </Button>
    </ScrollView>
  );
}
