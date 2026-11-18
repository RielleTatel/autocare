import { useRef, useState } from "react";
import { Image, ScrollView, Text, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, workContent } from "../../components/FieldLayout";
import type { LocalObservation } from "../../shared/db/inspections.repo";

/** Observations outside the booked checks do not change completeness or score. */
export function AdditionalFindingsScreen({ observations, onSave, onDelete, onPhoto, onBack }: {
  observations: LocalObservation[];
  onSave(observation: LocalObservation): Promise<void>;
  onDelete(clientUuid: string): Promise<void>;
  onPhoto(clientUuid: string): Promise<void>;
  onBack(): void;
}) {
  const [entries, setEntries] = useState(observations);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const lastSave = useRef(0);
  const save = async (entry: LocalObservation) => {
    setSaved(false);
    const attempt = ++lastSave.current;
    try {
      if (entry.photoUris.length && !entry.notes.trim()) throw new Error("Add notes to identify these photos, or remove this finding.");
      await onSave(entry);
      if (attempt === lastSave.current) { setSaved(true); setError(null); }
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save this finding. Try again."); }
  };
  const edit = (clientUuid: string, notes: string) => {
    const current = entries.find((entry) => entry.clientUuid === clientUuid);
    if (!current) return;
    const next = { ...current, notes };
    setEntries((all) => all.map((entry) => entry.clientUuid === clientUuid ? next : entry));
    void save(next);
  };
  const add = async () => {
    if (busy || entries.length >= 100) return;
    const entry = { clientUuid: randomUUID(), notes: "", photoUris: [] };
    setBusy(true); setError(null);
    try { await onSave(entry); setEntries((all) => [...all, entry]); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not add this finding."); }
    finally { setBusy(false); }
  };
  const remove = async (clientUuid: string) => {
    if (busy) return;
    setBusy(true);
    try { await onDelete(clientUuid); ++lastSave.current; setEntries((all) => all.filter((entry) => entry.clientUuid !== clientUuid)); setSaved(true); setError(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not remove this finding."); }
    finally { setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Additional findings" onBack={saved && !error && !busy ? onBack : undefined} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={workContent}>
      <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Record an issue observed outside the booked checks. Notes and photos stay separate from the checklist score.</Text>
      {entries.map((entry, index) => <View key={entry.clientUuid} style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: t.colors.line }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Finding {index + 1}</Text>
        <TextInput accessibilityLabel={`Additional finding ${index + 1} notes`} multiline maxLength={2000} value={entry.notes} editable={!busy} onChangeText={(notes) => edit(entry.clientUuid, notes)} placeholder="Describe the issue and where it was observed." textAlignVertical="top" style={{ ...t.text("body"), minHeight: 128, padding: 16, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.sm, backgroundColor: t.colors.surface, color: t.colors.ink }} />
        {entry.photoUris.length ? <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{entry.photoUris.map((uri) => <Image key={uri} source={{ uri }} accessibilityLabel={`Additional finding ${index + 1} photo`} style={{ width: 120, height: 90, borderRadius: 8 }} />)}</ScrollView> : null}
        <Button variant="secondary" icon="camera" disabled={busy || !entry.notes.trim() || !saved} onPress={() => { setBusy(true); void onPhoto(entry.clientUuid).catch((failure) => { setError(failure instanceof Error ? failure.message : "Could not open the camera."); setBusy(false); }); }}>Add optional photo</Button>
        <Button variant="ghost" disabled={busy} onPress={() => { void remove(entry.clientUuid); }}>Remove finding</Button>
      </View>)}
      {!entries.length ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>No additional findings recorded.</Text> : null}
      <Button variant="secondary" disabled={busy || entries.length >= 100} onPress={() => { void add(); }}>Add finding</Button>
      {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{error}</Text><Button variant="secondary" disabled={busy} onPress={() => { void (async () => {
        try {
          if (entries.some((entry) => entry.photoUris.length && !entry.notes.trim())) throw new Error("Add notes to identify these photos, or remove the finding.");
          await Promise.all(entries.map(onSave)); setSaved(true); setError(null);
        } catch (failure) { setError(failure instanceof Error ? failure.message : "The findings have not saved. Retry saving them."); }
      })(); }}>Retry saving findings</Button></View> : <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{saved ? "Saved on this device. Empty findings are not included when submitting." : "Saving findings…"}</Text>}
    </ScrollView>
    <ActionBar><Button disabled={busy || !saved || !!error} onPress={onBack}>Return to checks</Button></ActionBar>
  </View>;
}
