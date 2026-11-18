import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { fieldTheme as t } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { ActionBar, Disclosure, workContent } from "../../components/FieldLayout";
import { Icon, type IconName } from "../../components/Icon";
import { outbox, photoUploader, syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import type { OutboxEntry } from "../../shared/sync/types";
import { discardRejected } from "./discard";

const ENTITY_ICONS: Record<string, IconName> = { inspection: "wrench", waste_record: "droplet", trip_status: "truck", trip_condition: "clipboard-list", payment_cash: "banknote" };
const entityLabel = (type: string) => type.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
function age(createdAt: number): string {
  const mins = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60); return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}
export function SyncQueueScreen({ storageUsedBytes = 0, onBack }: { storageUsedBytes?: number; onBack?(): void }) {
  const status = useSyncStatus(syncProcessor);
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [photos, setPhotos] = useState({ pending: 0, failed: 0, lastError: null as string | null });
  const refresh = useCallback(async () => {
    const [queued, parked, photoState] = await Promise.all([outbox.pendingInOrder(), outbox.rejectedInOrder(), photoUploader.summary()]);
    setPending(queued); setRejected(parked); setPhotos(photoState); setLoaded(true);
  }, []);
  useEffect(() => {
    void refresh().catch(() => setActionError("Could not read saved records. Reopen the sync queue to try again."));
    return syncProcessor.subscribe(() => { void refresh().catch(() => undefined); });
  }, [refresh]);
  const confirmDiscard = useCallback((entry: OutboxEntry) => {
    Alert.alert("Discard this record?", "The inspection data saved on this device will be deleted and cannot be recovered.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => { void (async () => { try { await discardRejected(entry); setExpanded(null); await refresh(); } catch { setActionError("Could not discard this record. Try again."); } })(); } },
    ]);
  }, [refresh]);
  const retryRecord = async (entry: OutboxEntry) => {
    if (retrying || status.isDraining) return;
    setRetrying(true); setActionError(null);
    try {
      const owner = typeof entry.payload?.inspectionClientUuid === "string" ? entry.payload.inspectionClientUuid : entry.clientUuid;
      await outbox.retry(owner); await syncProcessor.refreshStatus(); await syncProcessor.drain({ force: true }); await refresh(); setExpanded(null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Could not retry this record."); }
    finally { setRetrying(false); }
  };
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Sync queue" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      <Text style={[t.text("body"), { color: t.colors.ink }]}>{status.pendingCount} pending · {status.rejectedCount} need attention</Text>
      {status.lastSyncAt ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Last synced {age(status.lastSyncAt)} ago</Text> : null}
      {photos.pending || photos.failed ? <Card style={{ gap: 12 }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Optional inspection photos</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{photos.pending} waiting · {photos.failed} need retry. Report acceptance and health scores are separate from photo delivery.</Text>
        {photos.lastError ? <Text style={[t.text("label"), { color: t.colors.danger }]}>{photos.lastError}</Text> : null}
        <Button variant="secondary" disabled={retrying || status.isDraining} onPress={() => {
          setRetrying(true); setActionError(null);
          void photoUploader.retryFailed().then(() => syncProcessor.drain({ force: true })).then(refresh)
            .catch((failure) => setActionError(failure instanceof Error ? failure.message : "Could not retry optional photos."))
            .finally(() => setRetrying(false));
        }}>Retry optional photos</Button>
      </Card> : null}
      {rejected.length ? <View style={{ gap: 8 }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Needs attention</Text>
        {rejected.map((entry) => <Card key={entry.clientUuid} pad="none" style={{ overflow: "hidden" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${entityLabel(entry.entityType)} rejected by server`} accessibilityState={{ expanded: expanded === entry.clientUuid }} onPress={() => setExpanded(expanded === entry.clientUuid ? null : entry.clientUuid)} style={{ minHeight: t.minTarget, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name="alert-triangle" color={t.colors.danger} /><View style={{ flex: 1, gap: 4 }}><Text style={[t.text("body", 600), { color: t.colors.ink }]}>{entityLabel(entry.entityType)}</Text><Text style={[t.text("label"), { color: t.colors.danger }]}>Rejected by server</Text></View><Icon name={expanded === entry.clientUuid ? "chevron-down" : "chevron-right"} size={20} color={t.colors.inkMuted} />
          </Pressable>
          {expanded === entry.clientUuid ? <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
            <Text style={[t.text("body"), { color: t.colors.danger }]}>{entry.lastError}</Text>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>This record was not accepted. Retry sends the same saved record and references; it does not create another inspection. If it is still rejected, review the error with an advisor.</Text>
            <Button variant="secondary" icon="refresh-cw" disabled={retrying || status.isDraining} accessibilityLabel={`Retry ${entityLabel(entry.entityType)}`} onPress={() => { void retryRecord(entry); }}>Retry saved record</Button>
            <Disclosure title="More options"><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Discard only if this saved work is no longer needed.</Text><Button variant="ghost" block={false} icon="trash-2" accessibilityLabel={`Discard ${entityLabel(entry.entityType)}`} onPress={() => confirmDiscard(entry)}>Discard saved record</Button></Disclosure>
          </View> : null}
        </Card>)}
      </View> : null}
      {status.lastError ? <EmptyState tone="error" title="Sync needs attention" body={status.lastError} /> : null}
      {pending.length ? <View style={{ gap: 8 }}><Text style={[t.text("h2"), { color: t.colors.ink }]}>Waiting to sync</Text>{pending.map((entry) => <Card key={entry.clientUuid} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name={ENTITY_ICONS[entry.entityType] ?? "package"} color={t.colors.inkMuted} /><View style={{ flex: 1, gap: 4 }}><Text style={[t.text("body"), { color: t.colors.ink }]}>{entityLabel(entry.entityType)}</Text><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{entry.op === "create" ? "Save record" : entry.op === "submit" ? "Submit report" : entry.op} · {age(entry.createdAt)} old</Text></View><StatusPill tone={entry.attempts > 0 ? "warn" : "neutral"}>{entry.attempts > 0 ? "Retrying" : "Queued"}</StatusPill></Card>)}</View> : null}
      {loaded && !pending.length && !rejected.length && !photos.pending && !photos.failed && !status.lastError ? <EmptyState title="Everything is synced" body="Your saved records have been sent." /> : !loaded && !actionError ? <EmptyState tone="loading" title="Loading saved records…" /> : null}
      {actionError ? <Text accessibilityRole="alert" style={[t.text("body"), { color: t.colors.danger }]}>{actionError}</Text> : null}
      {storageUsedBytes > 0 ? <Disclosure title="Storage details"><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Local queue storage: {(storageUsedBytes / 1024).toFixed(0)} KB</Text></Disclosure> : null}
    </ScrollView>
    <ActionBar hint={status.rejectedCount ? "Rejected records need review before they can sync." : "Saved work stays on this device until the server accepts it."}><Button icon="refresh-cw" disabled={status.isDraining || retrying} accessibilityLabel="Sync now" onPress={() => { void syncProcessor.drain({ force: true }); }}>{status.isDraining ? "Syncing…" : "Sync now"}</Button></ActionBar>
  </View>;
}
