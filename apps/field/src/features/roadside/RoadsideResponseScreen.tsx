import { useState } from "react";
import { Linking, ScrollView, Text, TextInput, View } from "react-native";
import { roadsideStatuses, type RoadsideRequestView, type RoadsideStatus } from "@autocare/contracts";
import { fieldTheme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { FieldNav } from "../../components/FieldNav";
import { StatusPill } from "../../components/StatusPill";
import { INCIDENT_LABEL, STATUS_LABEL, STATUS_TONE, placeText } from "./incidentLabels";

/** The steps a responder drives from the roadside. REQUESTED/ACKNOWLEDGED are
 *  the advisor's end of the timeline, and RESOLVED goes through the resolve
 *  form because it needs notes and a cost. */
const DRIVER_STEPS: RoadsideStatus[] = ["DISPATCHED", "EN_ROUTE", "ON_SITE"];

/**
 * F-17 — roadside response (FR-038/FR-039).
 *
 * Navigation is deliberately a hand-off to the phone's own maps app rather than
 * an embedded map: a driver needs turn-by-turn, which a static map cannot give,
 * and the same choice is already made for pick-up trips (F-13) and for the
 * advisor's view of an incident.
 */
export function RoadsideResponseScreen({
  request, busy, error, onSetStatus, onResolve, onBack,
}: {
  request: RoadsideRequestView;
  busy: boolean;
  error: string | null;
  onSetStatus: (status: RoadsideStatus) => void;
  onResolve: (dto: { resolutionNotes: string; costCentavos: number }) => void;
  onBack?: () => void;
}) {
  const t = fieldTheme;
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [pesos, setPesos] = useState("");

  const currentIndex = roadsideStatuses.indexOf(request.status);
  const resolved = request.status === "RESOLVED";
  // Only forward moves exist here — the server answers a backwards transition
  // with a 409, so offering one would be offering a guaranteed error.
  const nextSteps = DRIVER_STEPS.filter((s) => roadsideStatuses.indexOf(s) > currentIndex);
  const onSite = request.status === "ON_SITE";

  const submitResolve = () => {
    const text = notes.trim();
    if (text.length < 3) return;
    // Money is centavos everywhere in this system; the driver types pesos.
    const amount = Math.round(Number.parseFloat(pesos) * 100);
    onResolve({ resolutionNotes: text, costCentavos: Number.isFinite(amount) ? amount : 0 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Roadside call" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }} testID="roadside-response-screen">
        <Card style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Text style={{ ...t.text("h1"), color: t.colors.ink, flex: 1 }}>{INCIDENT_LABEL[request.incidentType]}</Text>
            <StatusPill tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</StatusPill>
          </View>
          <Text style={{ ...t.text("body"), color: t.colors.ink }}>{placeText(request)}</Text>
          {request.landmarkNote ? (
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{request.landmarkNote}</Text>
          ) : null}
          <Button
            testID="roadside-navigate"
            variant="secondary"
            onPress={() => {
              void Linking.openURL(`https://maps.google.com/?q=${request.lat},${request.lng}`);
            }}
          >
            Open in maps
          </Button>
        </Card>

        {error ? (
          <Text testID="roadside-error" style={{ ...t.text("body"), color: t.colors.danger }}>
            {error}
          </Text>
        ) : null}

        {resolved ? (
          <Card>
            <Text style={{ ...t.text("body"), color: t.colors.ink }}>
              This call is resolved. Nothing further is needed.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            {nextSteps.map((s) => (
              <Button key={s} testID={`advance-${s}`} disabled={busy} onPress={() => onSetStatus(s)}>
                {`Mark ${STATUS_LABEL[s].toLowerCase()}`}
              </Button>
            ))}

            {onSite && !resolving ? (
              <Button testID="resolve-open" variant="deep" onPress={() => setResolving(true)}>
                Close this call
              </Button>
            ) : null}

            {onSite && resolving ? (
              <Card style={{ gap: t.spacing.sm }}>
                <Text style={{ ...t.text("h2"), color: t.colors.ink }}>What did you do?</Text>
                <TextInput
                  testID="resolve-notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Jump-started on site"
                  placeholderTextColor={t.colors.inkFaint}
                  multiline
                  style={{
                    ...t.text("body"),
                    color: t.colors.ink,
                    minHeight: t.minTarget,
                    backgroundColor: t.colors.surface,
                    borderWidth: t.borders.hairline,
                    borderColor: t.colors.line,
                    borderRadius: t.radii.sm,
                    padding: t.spacing.sm,
                  }}
                />
                <TextInput
                  testID="resolve-cost"
                  value={pesos}
                  onChangeText={setPesos}
                  placeholder="Cost in pesos (0 if covered)"
                  placeholderTextColor={t.colors.inkFaint}
                  keyboardType="decimal-pad"
                  style={{
                    ...t.text("body"),
                    color: t.colors.ink,
                    minHeight: t.minTarget,
                    backgroundColor: t.colors.surface,
                    borderWidth: t.borders.hairline,
                    borderColor: t.colors.line,
                    borderRadius: t.radii.sm,
                    paddingHorizontal: t.spacing.sm,
                  }}
                />
                <Button testID="resolve-submit" disabled={busy} onPress={submitResolve}>
                  Resolve call
                </Button>
              </Card>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
