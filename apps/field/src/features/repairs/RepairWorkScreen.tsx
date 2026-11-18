import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { fieldTheme as t } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { Plate } from "../../components/Plate";
import { Reference } from "../../components/References";
import { StatusPill } from "../../components/StatusPill";
import { parseRepairEstimate, repairPeso } from "./repairDraft";
import { useRepairWork } from "./useRepairWork";
import { getRepairReturnSlots, type RepairReturnSlot, type RepairStatus } from "./repairApi";

const STATUS: Record<RepairStatus, string> = {
  IN_PROGRESS: "Repair in progress",
  AWAITING_ADMIN_REVIEW: "Awaiting admin review",
  RETURNED_FOR_CORRECTION: "Returned for correction",
  VERIFIED: "Verified by admin",
  STOPPED: "Stopped · awaiting admin review",
};

function nextManilaDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + 86_400_000));
}

function slotLabel(value: string) {
  return new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function RepairWorkScreen({ vehicleId, inspectionId, vehiclePlateNo, role, onBack }: {
  vehicleId: string; inspectionId: string; vehiclePlateNo?: string; role: string; onBack(): void;
}) {
  const work = useRepairWork({ vehicleId, inspectionId });
  const navigation = useNavigation();
  const [rechecked, setRechecked] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [returnDate, setReturnDate] = useState(nextManilaDate);
  const [returnSlots, setReturnSlots] = useState<RepairReturnSlot[]>([]);
  const [selectedReturnSlot, setSelectedReturnSlot] = useState<RepairReturnSlot | null>(null);
  const [slotsBusy, setSlotsBusy] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  usePreventRemove(work.saving || !!work.localError, ({ data }) => {
    void work.flush().then(() => navigation.dispatch(data.action)).catch(() => setNavigationError("The latest notes have not saved. Retry saving before leaving this repair."));
  });
  const allowed = role === "MECHANIC" || role === "ADMIN";
  const editable = work.ready && !work.busy && !work.draft.pendingAction;
  const actionable = editable && work.verified && !work.loading && !work.localError;
  const estimate = parseRepairEstimate(work.draft.estimatedTotal);
  const activeRepair = work.repair?.repairStatus === "IN_PROGRESS" || work.repair?.repairStatus === "RETURNED_FOR_CORRECTION";
  const returnedRepair = work.repair?.repairStatus === "RETURNED_FOR_CORRECTION";
  const pending = work.draft.pendingAction;
  const saveHint = work.localError ? "Draft has unsaved changes." : work.saving ? "Saving draft on this device…" : "Draft saved on this device. Repair actions require a connection.";
  const findReturnSlots = async () => {
    if (!work.repair?.serviceTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) { setReturnError("Enter a return date as YYYY-MM-DD."); return; }
    setSlotsBusy(true); setReturnError(null); setSelectedReturnSlot(null);
    try { setReturnSlots(await getRepairReturnSlots(work.repair.serviceTypeId, returnDate)); }
    catch (failure) { setReturnSlots([]); setReturnError(failure instanceof Error ? failure.message : "Could not load return slots."); }
    finally { setSlotsBusy(false); }
  };

  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Repair work" onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={workContent}>
      {vehiclePlateNo ? <Plate variant="plain">{vehiclePlateNo}</Plate> : null}
      {!allowed ? <EmptyState title="Repair access required" body="A mechanic or admin can proceed with repair work." /> : <>
        {work.loading ? <EmptyState tone="loading" title="Checking repair state…" /> : null}
        {work.localError || navigationError ? <EmptyState tone="error" title="Save needs attention" body={work.localError ?? navigationError ?? undefined}
          action={work.ready ? <Button variant="secondary" onPress={() => { void work.saveAgain().then(() => setNavigationError(null)).catch(() => undefined); }}>Retry saving draft</Button> : undefined} /> : null}
        {work.serverError ? <EmptyState tone="error" title="Repair state unavailable" body={`${work.serverError} Your saved notes stay on this device.`}
          action={<Button variant="secondary" disabled={work.busy || work.loading} onPress={() => { void work.refresh(); }}>Refresh repair</Button>} /> : null}
        {pending ? <Card accent={t.vhsBands.FAIR.text} style={{ gap: 12 }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>Check the previous action</Text>
          <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>The previous {pending.action === "start" ? "start" : pending.action} request has no confirmed response. Reconnect to check this repair and retry the same request.</Text>
          <Button disabled={work.busy || !work.ready || !!work.localError} onPress={() => { void work.retry(); }}>{work.busy ? "Checking…" : "Check and retry previous action"}</Button>
        </Card> : null}
        {work.repair ? <>
          <Card style={{ gap: 12 }}>
            <StatusPill tone={work.repair.repairStatus === "VERIFIED" ? "success" : "info"}>{STATUS[work.repair.repairStatus] ?? work.repair.repairStatus}</StatusPill>
            {!work.verified ? <Text style={[t.text("label"), { color: t.vhsBands.FAIR.text }]}>Reconnect to confirm the current server state.</Text> : null}
            <Text style={[t.text("body"), { color: t.colors.ink }]}>{work.repair.notes}</Text>
            <View style={{ gap: 4 }}><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Estimated additional repairs</Text><Text style={[t.text("h1"), { color: t.colors.ink }]}>{repairPeso(work.repair.estimatedTotalCentavos)}</Text><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Admin verifies the final amount before billing.</Text></View>
            {work.repair.reviewReason ? <Text style={[t.text("body"), { color: t.vhsBands.FAIR.text }]}>{work.repair.reviewReason}</Text> : null}
          </Card>
          {work.repair.repairStatus === "IN_PROGRESS" ? work.repair.returnScheduledStart ? <Card style={{ gap: 8 }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>Return visit scheduled</Text>
            <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{slotLabel(work.repair.returnScheduledStart)}</Text>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>The visit is linked to this repair and does not create another service charge.</Text>
          </Card> : work.repair.serviceTypeId ? <Disclosure title="Schedule a return visit">
            <View style={{ gap: 12 }}>
              <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Choose an available workshop slot. The return visit stays linked to this repair and does not consume another subscription entitlement.</Text>
              <RepairInput label="Return date (YYYY-MM-DD)" value={returnDate} onChangeText={(value) => { setReturnDate(value); setReturnSlots([]); setSelectedReturnSlot(null); }} editable={editable} maxLength={10} placeholder="2026-11-19" />
              <Button variant="secondary" disabled={!actionable || slotsBusy || work.busy || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)} onPress={() => { void findReturnSlots(); }}>{slotsBusy ? "Finding slots…" : "Find available slots"}</Button>
              {returnError ? <Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{returnError}</Text> : null}
              {returnSlots.length === 0 && !slotsBusy && !returnError ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>No slots loaded for this date.</Text> : null}
              {returnSlots.map((slot) => <Button key={`${slot.start}:${slot.bayId}`} variant={selectedReturnSlot?.start === slot.start && selectedReturnSlot.bayId === slot.bayId ? "primary" : "secondary"} disabled={!actionable || work.busy} onPress={() => setSelectedReturnSlot(slot)}>{slotLabel(slot.start)} · Bay {slot.bayId.slice(0, 4)}</Button>)}
              {selectedReturnSlot ? <Button disabled={!actionable || work.busy} onPress={() => { void work.scheduleReturn(selectedReturnSlot); }}>{work.busy ? "Scheduling…" : "Schedule selected return"}</Button> : null}
            </View>
          </Disclosure> : <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>This repair has no original scheduled service to use for capacity planning.</Text> : null}
          {activeRepair && !pending ? <>
            {returnedRepair ? <View style={{ gap: 12 }}>
              <Text style={[t.text("body"), { color: t.vhsBands.FAIR.text }]}>Admin returned this repair for correction. Update the notes or estimate, then continue the work and send it for review again.</Text>
              <RepairInput label="Repair notes" value={work.draft.notes} onChangeText={(value) => work.edit({ notes: value })} editable={editable} multiline placeholder="Describe the repair work to carry out." />
              <RepairInput label="Estimated total (PHP)" value={work.draft.estimatedTotal} onChangeText={(value) => work.edit({ estimatedTotal: value })} editable={editable} keyboardType="decimal-pad" placeholder="0.00" maxLength={16} />
              <Text style={[t.text("label"), { color: work.draft.estimatedTotal && estimate === null ? t.colors.danger : t.colors.inkMuted }]}>{work.draft.estimatedTotal && estimate === null ? "Enter PHP 0.00 to 1,000,000.00 with up to two decimal places." : "The estimate covers additional repairs only. Admin verifies the final amount."}</Text>
            </View> : stopping ? <View style={{ gap: 12 }}>
              <Text style={[t.text("h2"), { color: t.colors.ink }]}>Stop this repair</Text>
              <RepairInput label="Work completed" value={work.draft.completedWorkNotes} onChangeText={(value) => work.edit({ completedWorkNotes: value })} editable={editable} multiline placeholder="Describe the work done, or say no work was completed." />
              <RepairInput label="Reason for stopping" value={work.draft.stopReason} onChangeText={(value) => work.edit({ stopReason: value })} editable={editable} multiline maxLength={1000} placeholder="Explain what remains unfinished." />
              <Button variant="secondary" disabled={work.busy} onPress={() => setStopping(false)}>Continue repair</Button>
            </View> : <View style={{ gap: 12 }}>
              <RepairInput label="Completion notes (optional)" value={work.draft.completionNotes} onChangeText={(value) => work.edit({ completionNotes: value })} editable={editable} multiline maxLength={2000} placeholder="Describe the result or anything admin should review." />
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Repaired issue rechecked" accessibilityState={{ checked: rechecked, disabled: !editable }} disabled={!editable} onPress={() => setRechecked(!rechecked)} style={{ minHeight: t.minTarget, padding: 12, borderWidth: 1, borderColor: rechecked ? t.colors.primary : t.colors.line, backgroundColor: t.colors.surface, borderRadius: t.radii.sm, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={[t.text("h2"), { color: t.colors.primary }]}>{rechecked ? "☑" : "☐"}</Text><Text style={[t.text("body", 600), { color: t.colors.ink, flex: 1 }]}>I rechecked the repaired issue</Text>
              </Pressable>
              <Button variant="ghost" disabled={!editable} onPress={() => setStopping(true)}>Stop repair</Button>
            </View>}
          </> : null}
          {!activeRepair ? <View style={{ gap: 8 }}>
            <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{work.repair.repairStatus === "VERIFIED" ? "Admin has reviewed this work. Billing and cash collection are handled at the counter." : "Admin reviews the completed work and final amount before issuing a bill."}</Text>
            {work.repair.completionNotes ? <Text style={[t.text("body"), { color: t.colors.ink }]}>{work.repair.completionNotes}</Text> : null}
            {work.repair.completedWorkNotes ? <Text style={[t.text("body"), { color: t.colors.ink }]}>{work.repair.completedWorkNotes}</Text> : null}
            {work.repair.stopReason ? <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Stopped: {work.repair.stopReason}</Text> : null}
          </View> : null}
        </> : work.ready ? <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}><Text style={[t.text("h1"), { color: t.colors.ink }]}>Additional repair work</Text><Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Enter the work discussed with the customer and its estimated additional cost.</Text></View>
          <RepairInput label="Repair notes" testID="repair-notes" value={work.draft.notes} onChangeText={(value) => work.edit({ notes: value })} editable={editable} multiline placeholder="Describe the repair work to carry out." />
          <RepairInput label="Estimated total (PHP)" testID="repair-estimate" value={work.draft.estimatedTotal} onChangeText={(value) => work.edit({ estimatedTotal: value })} editable={editable} keyboardType="decimal-pad" placeholder="0.00" maxLength={16} />
          <Text style={[t.text("label"), { color: work.draft.estimatedTotal && estimate === null ? t.colors.danger : t.colors.inkMuted }]}>{work.draft.estimatedTotal && estimate === null ? "Enter PHP 0.00 to 1,000,000.00 with up to two decimal places." : "Additional repairs only. The original booked service is reviewed separately. Zero is allowed."}</Text>
        </View> : null}
        <Text accessibilityLiveRegion="polite" style={[t.text("label"), { color: t.colors.inkMuted }]}>{work.ready ? saveHint : "Loading the saved draft…"}</Text>
        <Disclosure title="References"><Reference label="Inspection ID" value={inspectionId} /><Reference label="Vehicle ID" value={vehicleId} />{work.repair ? <><Reference label="Work order" value={work.repair.number} />{work.repair.appointmentId ? <Reference label="Original booking ID" value={work.repair.appointmentId} /> : null}</> : null}</Disclosure>
      </>}
    </ScrollView>
    {allowed && !pending && work.ready ? !work.repair ? <ActionBar hint="Proceed after the customer discussion. Starting work needs server acceptance."><Button testID="proceed-with-repair" disabled={!actionable || !work.draft.notes.trim() || estimate === null} onPress={() => { void work.start(); }}>{work.busy ? "Starting…" : "Proceed with repair"}</Button></ActionBar>
      : activeRepair ? returnedRepair ? <ActionBar hint="Save the correction before continuing repair work."><Button disabled={!actionable || !work.draft.notes.trim() || estimate === null} onPress={() => { void work.updateReturned(); }}>{work.busy ? "Submitting…" : "Submit corrections"}</Button></ActionBar> : <ActionBar hint="Completion or stopping sends this work to admin review."><Button variant={stopping ? "danger" : "primary"} disabled={!actionable || (stopping ? !work.draft.completedWorkNotes.trim() || !work.draft.stopReason.trim() : !rechecked)} onPress={() => { void (stopping ? work.stop() : work.complete(rechecked)); }}>{work.busy ? "Sending…" : stopping ? "Stop and send for review" : "Complete repair"}</Button></ActionBar> : <ActionBar><Button variant="secondary" disabled={work.loading || work.busy} onPress={() => { void work.refresh(); }}>Refresh repair</Button></ActionBar> : null}
  </View>;
}

function RepairInput({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><Text style={[t.text("body", 600), { color: t.colors.ink }]}>{label}</Text><TextInput accessibilityLabel={label} maxLength={4000} textAlignVertical={props.multiline ? "top" : "center"} {...props} style={{ ...t.text("body"), minHeight: props.multiline ? 128 : t.minTarget, padding: 16, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.sm, color: t.colors.ink, backgroundColor: t.colors.surface, opacity: props.editable === false ? 0.7 : 1 }} /></View>;
}
