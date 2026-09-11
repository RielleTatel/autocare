import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { RoadsideDispatchInput, RoadsideRequestView, RoadsideResponder } from "@autocare/contracts";
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
  requests, responders, loading, error, onRefresh, onDispatch, onOpen, onBack,
}: {
  requests: RoadsideRequestView[];
  /** Drivers this advisor may assign. Empty is fine — typing a name still works. */
  responders: RoadsideResponder[];
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
  const [picked, setPicked] = useState<RoadsideResponder | null>(null);
  const [responder, setResponder] = useState("");
  const [eta, setEta] = useState("");

  const openForm = (id: string) => {
    setAssigning(id);
    setPicked(null);
    setResponder("");
    setEta("");
  };

  const submit = (id: string) => {
    // A typed name wins: it is the later, more deliberate act, and it is how
    // FR-037's "contracted tow partner" — who has no user account — is named.
    // The picked id is dropped with it, so the call never records an identity
    // that disagrees with the name shown to the member.
    const typed = responder.trim();
    const name = typed || picked?.name?.trim() || "";
    if (!name) return;

    const minutes = Number.parseInt(eta, 10);
    const dto: RoadsideDispatchInput = { responderName: name };
    if (!typed && picked) dto.responderUserId = picked.id;
    // ETA is optional: an advisor who does not know yet still needs to get a
    // driver moving, and the contract marks it optional too.
    if (Number.isFinite(minutes)) dto.etaMinutes = minutes;

    onDispatch(id, dto);
    setAssigning(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav
        title="Roadside"
        onBack={onBack}
        right={
          <Pressable
            testID="roadside-refresh"
            accessibilityRole="button"
            accessibilityLabel="Refresh the roadside queue"
            onPress={onRefresh}
            style={{ minHeight: t.minTarget, justifyContent: "center", paddingHorizontal: t.spacing.sm }}
          >
            <Text style={{ ...t.text("label", 600), color: t.colors.primary }}>{loading ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
        }
      />
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
                  {responders.length > 0 ? (
                    <View style={{ gap: t.spacing.xs ?? 4 }}>
                      <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>On-duty drivers</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
                        {responders.map((d) => {
                          const selected = picked?.id === d.id;
                          return (
                            <Pressable
                              key={d.id}
                              testID={`responder-${d.id}`}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              onPress={() => {
                                setPicked(d);
                                setResponder("");
                              }}
                              style={{
                                minHeight: t.minTarget,
                                justifyContent: "center",
                                paddingHorizontal: t.spacing.sm,
                                borderRadius: t.radii.pill,
                                borderWidth: t.borders.hairline,
                                borderColor: selected ? t.colors.primary : t.colors.line,
                                backgroundColor: selected ? t.colors.primary : t.colors.surface,
                              }}
                            >
                              <Text style={{ ...t.text("label", 600), color: selected ? "#FFFFFF" : t.colors.ink }}>
                                {d.name ?? "Unnamed driver"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  <TextInput
                    testID="dispatch-responder"
                    value={responder}
                    onChangeText={setResponder}
                    placeholder={responders.length > 0 ? "…or type a tow partner" : "Responder name"}
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
