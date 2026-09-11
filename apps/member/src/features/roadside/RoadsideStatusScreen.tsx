import { ScrollView, Text, View } from "react-native";
import { roadsideStatuses, type RoadsideRequestView, type RoadsideStatus } from "@autocare/contracts";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { BackBar } from "../../components/BackBar";
import { Icon } from "../../components/Icon";
import { IncidentMap } from "./IncidentMap";

const STEP_LABEL: Record<RoadsideStatus, string> = {
  REQUESTED: "Requested",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  EN_ROUTE: "On the way",
  ON_SITE: "On site",
  RESOLVED: "Resolved",
};

/**
 * M-27 — the wait, made legible.
 *
 * Status colours are semantic (success / muted), never band tokens: a band
 * colour on this screen would read as a vehicle score (design principle 1).
 * The map is read-only (D-3): once the request is in, the location is settled
 * and a draggable pin would imply otherwise.
 */
export function RoadsideStatusScreen({
  request,
  stale,
  onCallHotline,
  onOpenInMaps,
  onBack,
}: {
  request: RoadsideRequestView;
  /** True when the last poll failed — the member is looking at old data. */
  stale: boolean;
  onCallHotline: () => void;
  onOpenInMaps: () => void;
  onBack?: () => void;
}) {
  const t = theme;
  const currentIndex = roadsideStatuses.indexOf(request.status);
  const resolved = request.status === "RESOLVED";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      testID="roadside-status-screen"
    >
      <BackBar onBack={onBack} />

      <View style={{ gap: 4 }}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>{resolved ? "You're sorted" : "Help is coming"}</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          {resolved
            ? "This call-out is closed. Thanks for your patience."
            : "We'll keep this updated as your responder moves."}
        </Text>
      </View>

      {stale ? (
        <Card testID="roadside-stale" accent={t.colors.danger}>
          <Text style={[t.text("label"), { color: t.colors.ink }]}>
            Showing the last update we received — we'll refresh when you're back online.
          </Text>
        </Card>
      ) : null}

      {request.responderName ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
          <Icon name="wrench" size={24} color={t.colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>{request.responderName}</Text>
            {request.etaMinutes != null ? (
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>About {request.etaMinutes} min away</Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: t.spacing.md }}>
        {roadsideStatuses.map((s, i) => {
          const done = i <= currentIndex;
          return (
            <View
              key={s}
              testID={`step-${s}`}
              accessibilityState={{ selected: done }}
              style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: t.radii.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? t.colors.success : t.colors.surfaceSunken,
                }}
              >
                {done ? <Icon name="check" size={14} color={t.colors.onPrimary} /> : null}
              </View>
              <Text style={[t.text("body"), { color: done ? t.colors.ink : t.colors.inkFaint }]}>{STEP_LABEL[s]}</Text>
            </View>
          );
        })}
      </Card>

      <IncidentMap lat={request.lat} lng={request.lng} editable={false} />

      <Card style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Where we're coming to</Text>
        <Text style={[t.text("body"), { color: t.colors.ink }]}>
          {request.address ?? `${request.lat.toFixed(5)}, ${request.lng.toFixed(5)}`}
        </Text>
        {request.landmarkNote ? (
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{request.landmarkNote}</Text>
        ) : null}
        <Button variant="secondary" icon="map-pin" testID="roadside-open-maps" onPress={onOpenInMaps}>
          Open in maps
        </Button>
      </Card>

      <Button block variant="secondary" icon="phone-call" testID="roadside-hotline" onPress={onCallHotline}>
        Call the hotline
      </Button>
    </ScrollView>
  );
}
