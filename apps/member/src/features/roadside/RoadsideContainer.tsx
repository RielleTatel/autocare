import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import type { RoadsideEligibility, RoadsideRequestView } from "@autocare/contracts";
import { theme } from "../../theme";
import { roadsideApi } from "./roadsideApi";
import { captureLocation, type LocationResult } from "./location";
import { RoadsideRequestScreen, type RoadsideSubmit } from "./RoadsideRequestScreen";
import { RoadsideStatusScreen } from "./RoadsideStatusScreen";
import { useRoadsideStatus } from "./useRoadsideStatus";

/** FR-040 fallback. Replace with the real dispatch line before launch. */
export const ROADSIDE_HOTLINE = "+6329110000";

function StatusView({ initial, onCallHotline }: { initial: RoadsideRequestView; onCallHotline: () => void }) {
  const { request, error } = useRoadsideStatus(initial);
  return (
    <RoadsideStatusScreen
      request={request}
      stale={error}
      onCallHotline={onCallHotline}
      onOpenInMaps={() => Linking.openURL(`https://maps.google.com/?q=${request.lat},${request.lng}`)}
    />
  );
}

export function RoadsideContainer({ vehicleId }: { vehicleId: string }) {
  const [eligibility, setEligibility] = useState<RoadsideEligibility | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [live, setLive] = useState<RoadsideRequestView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callHotline = useCallback(() => {
    void Linking.openURL(`tel:${ROADSIDE_HOTLINE}`);
  }, []);

  const getLocation = useCallback(() => {
    void captureLocation()
      .then(setLocation)
      .catch(() => setLocation({ ok: false, reason: "UNAVAILABLE" }));
  }, []);

  useEffect(() => {
    // An open incident wins: returning to the app mid-call-out must not show
    // a form that could open a second one.
    void roadsideApi
      .active()
      .then(setLive)
      .catch(() => setLive(null));
    void roadsideApi
      .eligibility()
      .then(setEligibility)
      .catch(() =>
        setEligibility({
          eligible: false,
          reason: "We couldn't check your cover. Call the hotline and we'll sort it.",
        }),
      );
    getLocation();
  }, [getLocation]);

  async function submit(s: RoadsideSubmit) {
    setSubmitting(true);
    setError(null);
    try {
      setLive(await roadsideApi.create({ vehicleId, ...s }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send that. Call the hotline and we'll sort it.");
    } finally {
      setSubmitting(false);
    }
  }

  if (live) return <StatusView initial={live} onCallHotline={callHotline} />;

  if (!eligibility) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Checking your cover…</Text>
      </View>
    );
  }

  return (
    <RoadsideRequestScreen
      eligibility={eligibility}
      location={location}
      onRetryLocation={getLocation}
      onSubmit={submit}
      onCallHotline={callHotline}
      submitting={submitting}
      error={error}
    />
  );
}
