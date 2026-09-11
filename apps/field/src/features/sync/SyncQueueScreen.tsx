import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { Icon, type IconName } from "../../components/Icon";
import { outbox, syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import type { OutboxEntry } from "../../shared/sync/types";
import { discardRejected } from "./discard";

const ENTITY_ICONS: Record<string, IconName> = {
  inspection: "wrench",
  waste_record: "droplet",
  trip_status: "truck",
  trip_condition: "clipboard-list",
  payment_cash: "banknote",
};

const entityLabel = (entityType: string) =>
  entityType.replace("_", " ").replace(/^./, (c) => c.toUpperCase());

function age(createdAt: number): string {
  const mins = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

/** F-03 — sync queue detail: each entry with its own state pill, parked
 *  rejections expandable to the server error, manual "Sync now". */
export function SyncQueueScreen({ storageUsedBytes = 0, onBack }: { storageUsedBytes?: number; onBack?(): void }) {
  const t = fieldTheme;
  const status = useSyncStatus(syncProcessor);
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [rejected, setRejected] = useState<OutboxEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPending(await outbox.pendingInOrder());
    setRejected(await outbox.rejectedInOrder());
  }, []);

  useEffect(() => {
    refresh();
    return syncProcessor.subscribe(() => { void refresh(); });
  }, [refresh]);

  /** Destructive and irreversible — the local inspection goes with it — so it
   *  asks first. Discarding a create also takes its dependent submit, which is
   *  why the copy says "record" rather than naming one queue row. */
  const confirmDiscard = useCallback((e: OutboxEntry) => {
    Alert.alert(
      "Discard this record?",
      "The inspection data saved on this device will be deleted and cannot be recovered.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await discardRejected(e);
              setExpanded(null);
              await refresh();
            })();
          },
        },
      ],
    );
  }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Sync queue" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
          {status.pendingCount} pending · {status.rejectedCount} needs attention
          {status.lastSyncAt ? ` · last sync ${age(status.lastSyncAt)} ago` : ""}
        </Text>

        {pending.map((e) => (
          <Card key={e.clientUuid} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm, minHeight: t.minTarget }}>
            <Icon name={ENTITY_ICONS[e.entityType] ?? "package"} size={22} color={t.colors.inkMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.text("body"), color: t.colors.ink }}>{entityLabel(e.entityType)} · {e.op}</Text>
              <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>{age(e.createdAt)} old</Text>
            </View>
            <StatusPill tone={e.attempts > 0 ? "warn" : "neutral"}>
              {e.attempts > 0 ? "RETRYING" : "QUEUED"}
            </StatusPill>
          </Card>
        ))}

        {pending.length === 0 && rejected.length === 0 ? (
          <EmptyState title="Everything is synced" body="Nothing is waiting to leave this device." />
        ) : null}

        {rejected.length > 0 && (
          <View style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.danger }}>Needs attention</Text>
            {rejected.map((e) => (
              <Card
                key={e.clientUuid}
                accent={t.colors.danger}
                interactive
                accessibilityLabel={`${entityLabel(e.entityType)} rejected by server`}
                onPress={() => setExpanded(expanded === e.clientUuid ? null : e.clientUuid)}
                style={{ minHeight: t.minTarget, justifyContent: "center" }}
              >
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>
                  {entityLabel(e.entityType)} · {e.op} · rejected by server
                </Text>
                {expanded === e.clientUuid && (
                  <View style={{ paddingTop: t.spacing.xs, gap: t.spacing.xs }}>
                    <Text style={{ ...t.text("label"), color: t.colors.danger }}>{e.lastError}</Text>
                    <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
                      This record was not accepted and will not be retried — the data it was sent
                      with cannot change. Discard it to clear the queue, then redo the job if it is
                      still needed.
                    </Text>
                    <Button
                      variant="secondary"
                      icon="trash-2"
                      accessibilityLabel={`Discard ${entityLabel(e.entityType)}`}
                      onPress={() => confirmDiscard(e)}
                    >
                      Discard
                    </Button>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        <Button
          variant="secondary"
          icon="refresh-cw"
          disabled={status.isDraining}
          accessibilityLabel="Sync now"
          onPress={() => { void syncProcessor.drain(); }}
        >
          {status.isDraining ? "Syncing…" : "Retry now"}
        </Button>

        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
          Local queue storage: {(storageUsedBytes / 1024).toFixed(0)} KB
        </Text>
      </ScrollView>
    </View>
  );
}
