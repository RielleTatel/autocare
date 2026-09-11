import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { RoadsideDispatchInput, RoadsideRequestView } from "@autocare/contracts";
import { fieldTheme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { StatusPill } from "../../components/StatusPill";
import { INCIDENT_LABEL, STATUS_LABEL, STATUS_TONE, placeText } from "./incidentLabels";

/**
 * F-18 — roadside dispatch, mobile fallback (FR-036/FR-037).
 *
 * The web console (W-10) is the primary dispatch surface; this exists for the
 * advisor who is away from the desk when a call comes in. Oldest first, because
 * an incident queue is a queue — the API already returns that order.
 */
export function RoadsideBoardScreen({
  requests, loading, error, onRefresh, onDispatch, onOpen, onBack,
}: {
  requests: RoadsideRequestView[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDispatch: (id: string, dto: RoadsideDispatchInput) => void;
  onOpen: (id: string) => void;
  onBack?: () => void;
}) {
  const t = fieldTheme;
  // Which card has its assign form open. One at a time: two half-filled forms
  // on an emergency screen is a way to dispatch the wrong driver.
  const [assigning, setAssigning] = useState<string | null>(null);
  const [responder, setResponder] = useState("");
  const [eta, setEta] = useState("");

  const openForm = (id: string) => {
    setAssigning(id);
    setResponder("");
    setEta("");
  };

  const submit = (id: string) => {
    const name = responder.trim();
    if (!name) return;
    const minutes = Number.parseInt(eta, 10);
    // ETA is optional: an advisor who does not know yet still needs to get a
    // driver moving, and the contract marks it optional too.
    onDispatch(id, Number.isFinite(minutes) ? { responderName: name, etaMinutes: minutes } : { responderName: name });
    setAssigning(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Roadside" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }} testID="roadside-board-screen">
        {error ? (
          <EmptyState
            tone="error"
            title="Couldn't load the queue"
            body={error}
            action={<Button onPress={onRefresh}>Try again</Button>}
          />
        ) : null}

        {!error && requests.length === 0 ? (
          <EmptyState
            tone={loading ? "loading" : "empty"}
            title={loading ? "Loading…" : "No open roadside calls"}
            body={loading ? undefined : "New requests appear here as soon as a member raises one."}
          />
        ) : null}

        {requests.map((r) => {
          const assigned = r.dispatchedToUserId !== null || r.responderName !== null;
          return (
            <Card key={r.id} testID={`incident-${r.id}`} onPress={() => onOpen(r.id)} style={{ gap: t.spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
                <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{INCIDENT_LABEL[r.incidentType]}</Text>
                <StatusPill tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusPill>
              </View>

              <Text style={{ ...t.text("body"), color: t.colors.ink }}>{placeText(r)}</Text>
              {r.landmarkNote ? (
                <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{r.landmarkNote}</Text>
              ) : null}

              {assigned ? (
                <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
                  {/* One string, not two nodes: assistive tech reads this as a
                      single line, and it stays matchable as written. */}
                  {r.etaMinutes != null ? `${r.responderName} · about ${r.etaMinutes} min` : `${r.responderName}`}
                </Text>
              ) : assigning === r.id ? (
                <View style={{ gap: t.spacing.sm }}>
                  <TextInput
                    testID="dispatch-responder"
                    value={responder}
                    onChangeText={setResponder}
                    placeholder="Responder name"
                    placeholderTextColor={t.colors.inkFaint}
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
                  <TextInput
                    testID="dispatch-eta"
                    value={eta}
                    onChangeText={setEta}
                    placeholder="ETA in minutes (optional)"
                    placeholderTextColor={t.colors.inkFaint}
                    keyboardType="number-pad"
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
                  <Button testID="dispatch-submit" onPress={() => submit(r.id)}>
                    Dispatch
                  </Button>
                </View>
              ) : (
                <Pressable
                  testID={`dispatch-${r.id}`}
                  accessibilityRole="button"
                  onPress={() => openForm(r.id)}
                  style={{ minHeight: t.minTarget, justifyContent: "center" }}
                >
                  <Text style={{ ...t.text("body", 600), color: t.colors.primary }}>Assign a responder</Text>
                </Pressable>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
