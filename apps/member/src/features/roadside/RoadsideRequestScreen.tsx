import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import type { IncidentType, RoadsideEligibility } from "@autocare/contracts";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { IncidentMap } from "./IncidentMap";
import { resolveAddress, type LocationResult } from "./location";

/** FR-033, in the member's words rather than the enum's. */
const INCIDENTS: { type: IncidentType; label: string }[] = [
  { type: "FLAT_TYRE", label: "Flat tyre" },
  { type: "DEAD_BATTERY", label: "Dead battery" },
  { type: "OUT_OF_FUEL", label: "Out of fuel" },
  { type: "OVERHEATING", label: "Overheating" },
  { type: "WILL_NOT_START", label: "Won't start" },
  { type: "ACCIDENT", label: "Accident" },
  { type: "OTHER", label: "Other" },
];

/** Long enough that a drag settles, short enough to beat a quick submit. */
const GEOCODE_DEBOUNCE_MS = 600;

export type RoadsideSubmit = {
  incidentType: IncidentType;
  lat: number;
  lng: number;
  address?: string;
  landmarkNote?: string;
};

/**
 * M-26 — raise an emergency.
 *
 * The screen is built so that no single failure blocks the request: a denied
 * permission leaves the landmark field, a failed geocode leaves the
 * coordinates, and an ineligible plan still leaves the hotline (FR-040).
 *
 * D-3: when there is a fix, the map is the member's correction channel and the
 * pin — not the raw GPS reading — is what gets submitted. With no fix there is
 * no map at all, and the landmark note carries the request (FR-032).
 */
export function RoadsideRequestScreen({
  eligibility,
  location,
  onRetryLocation,
  onSubmit,
  onCallHotline,
  submitting,
  error,
}: {
  eligibility: RoadsideEligibility;
  location: LocationResult | null;
  onRetryLocation: () => void;
  onSubmit: (s: RoadsideSubmit) => void;
  onCallHotline: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const t = theme;
  const [incident, setIncident] = useState<IncidentType | null>(null);
  const [landmark, setLandmark] = useState("");

  const hasFix = location?.ok === true;

  // Seeded from the fix, then owned by the member: every drag moves this, and
  // this is what the request is built from.
  const [pin, setPin] = useState<{ lat: number; lng: number; address: string | null } | null>(
    location?.ok ? { lat: location.lat, lng: location.lng, address: location.address } : null,
  );
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPin(location?.ok ? { lat: location.lat, lng: location.lng, address: location.address } : null);
  }, [location]);

  useEffect(() => () => { if (geocodeTimer.current) clearTimeout(geocodeTimer.current); }, []);

  /** Debounced: a drag emits many positions and each one is a billed request. */
  const movePin = (lat: number, lng: number) => {
    setPin({ lat, lng, address: null });
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      void resolveAddress(lat, lng).then((address) =>
        // Ignore a late reply for a position the member has already left.
        setPin((cur) => (cur && cur.lat === lat && cur.lng === lng ? { ...cur, address } : cur)),
      );
    }, GEOCODE_DEBOUNCE_MS);
  };

  // Without coordinates a landmark is the only thing that can route help.
  const canSend = !!incident && (hasFix || landmark.trim().length > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      testID="roadside-request-screen"
    >
      <View style={{ gap: 4 }}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>Roadside assistance</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          Tell us what happened and we'll send help to you.
        </Text>
      </View>

      {!eligibility.eligible ? (
        <Card accent={t.colors.danger} style={{ gap: t.spacing.sm }}>
          <Text style={[t.text("body"), { color: t.colors.ink }]}>{eligibility.reason}</Text>
          {eligibility.paidAlternativeCentavos != null ? (
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
              A one-off call-out costs ₱{(eligibility.paidAlternativeCentavos / 100).toLocaleString("en-PH")}.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>What happened?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
          {INCIDENTS.map((i) => {
            const selected = incident === i.type;
            return (
              <Pressable
                key={i.type}
                testID={`incident-${i.type}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setIncident(i.type)}
                style={{
                  minHeight: t.minTarget,
                  justifyContent: "center",
                  paddingHorizontal: t.spacing.md,
                  borderRadius: t.radii.pill,
                  borderWidth: selected ? t.borders.control : t.borders.hairline,
                  borderColor: selected ? t.colors.primary : t.colors.lineSoft,
                  backgroundColor: selected ? t.colors.primarySoft : t.colors.surface,
                }}
              >
                <Text style={[t.text("label", 600), { color: selected ? t.colors.primary : t.colors.ink }]}>
                  {i.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Where are you?</Text>
        {pin ? (
          <>
            <IncidentMap lat={pin.lat} lng={pin.lng} editable onMove={movePin} />
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
              Drag the pin if this isn't quite where you are.
            </Text>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
              <Icon name="map-pin" size={20} color={t.colors.primary} />
              <Text style={[t.text("body"), { color: t.colors.ink, flex: 1 }]}>
                {pin.address ?? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
              </Text>
            </Card>
          </>
        ) : (
          <Card accent={t.colors.danger} style={{ gap: t.spacing.sm }}>
            <Text style={[t.text("body"), { color: t.colors.ink }]}>
              We couldn't get your location — tell us where you are and we'll find you.
            </Text>
            <Button variant="secondary" icon="crosshair" testID="roadside-retry-location" onPress={onRetryLocation}>
              Try location again
            </Button>
          </Card>
        )}

        <TextInput
          testID="roadside-landmark"
          value={landmark}
          onChangeText={setLandmark}
          placeholder="Nearest landmark, e.g. beside the blue gate"
          placeholderTextColor={t.colors.inkFaint}
          multiline
          style={[
            t.text("body"),
            {
              minHeight: t.minTarget,
              color: t.colors.ink,
              backgroundColor: t.colors.surface,
              borderWidth: t.borders.hairline,
              borderColor: t.colors.lineSoft,
              borderRadius: t.radii.sm,
              padding: t.spacing.md,
            },
          ]}
        />
      </View>

      {error ? (
        <Text testID="roadside-error" style={[t.text("body"), { color: t.colors.danger }]}>
          {error}
        </Text>
      ) : null}

      {eligibility.eligible ? (
        <Button
          block
          variant="danger"
          testID="roadside-submit"
          disabled={!canSend || submitting}
          onPress={() => {
            if (!canSend || !incident) return;
            onSubmit({
              incidentType: incident,
              lat: pin ? pin.lat : 0,
              lng: pin ? pin.lng : 0,
              address: pin?.address ?? undefined,
              landmarkNote: landmark.trim() || undefined,
            });
          }}
        >
          {submitting ? "Sending…" : "Request assistance"}
        </Button>
      ) : null}

      {/* FR-040 — always reachable, eligible or not. */}
      <Button block variant="secondary" icon="phone-call" testID="roadside-hotline" onPress={onCallHotline}>
        Call the hotline instead
      </Button>
    </ScrollView>
  );
}
