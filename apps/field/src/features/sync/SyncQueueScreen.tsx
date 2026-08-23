import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { outbox, syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import type { OutboxEntry } from "../../shared/sync/types";

const ENTITY_ICONS: Record<string, string> = {
  inspection: "🔧", waste_record: "🛢️", trip_status: "🚚", trip_condition: "📋", payment_cash: "💵",
};

function age(createdAt: number): string {
  const mins = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

/** F-03 — sync queue detail: pending list grouped by entity, parked rejections
 *  expandable to the server error, manual "Sync now". */
export function SyncQueueScreen({ storageUsedBytes = 0 }: { storageUsedBytes?: number }) {
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

  const groups = new Map<string, OutboxEntry[]>();
  for (const e of pending) {
    groups.set(e.entityType, [...(groups.get(e.entityType) ?? []), e]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <View style={{ backgroundColor: t.colors.primaryDeep, padding: t.spacing.md, paddingTop: t.spacing.xl }}>
        <Text style={[t.text("h1"), { color: t.colors.onPrimary }]}>Sync queue</Text>
        <Text style={[t.text("body"), { color: t.colors.onPrimary, opacity: 0.85 }]}>
          {status.pendingCount} pending · {status.rejectedCount} needs attention
          {status.lastSyncAt ? ` · last sync ${age(status.lastSyncAt)} ago` : ""}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sync now"
          disabled={status.isDraining}
          onPress={() => { void syncProcessor.drain(); }}
          style={{
            minHeight: t.minTarget, borderRadius: t.radii.md, backgroundColor: t.colors.primary,
            alignItems: "center", justifyContent: "center", opacity: status.isDraining ? 0.6 : 1,
          }}
        >
          <Text style={[t.text("h2"), { color: t.colors.onPrimary }]}>
            {status.isDraining ? "Syncing…" : "Sync now"}
          </Text>
        </Pressable>

        {[...groups.entries()].map(([entity, entries]) => (
          <View key={entity} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.xs }}>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
              {ENTITY_ICONS[entity] ?? "📦"} {entity.replace("_", " ")} ({entries.length})
            </Text>
            {entries.map((e) => (
              <View key={e.clientUuid} style={{ flexDirection: "row", justifyContent: "space-between", minHeight: 32, alignItems: "center" }}>
                <Text style={[t.text("body"), { color: t.colors.ink }]}>{e.op} · {age(e.createdAt)} old</Text>
                <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
                  {e.attempts > 0 ? `${e.attempts} attempt${e.attempts === 1 ? "" : "s"}` : "queued"}
                </Text>
              </View>
            ))}
          </View>
        ))}
        {pending.length === 0 && (
          <Text style={[t.text("body"), { color: t.colors.inkMuted, textAlign: "center", padding: t.spacing.md }]}>
            Everything is synced
          </Text>
        )}

        {rejected.length > 0 && (
          <View style={{ gap: t.spacing.xs }}>
            <Text style={[t.text("h2"), { color: t.colors.danger }]}>Needs attention</Text>
            {rejected.map((e) => (
              <Pressable
                key={e.clientUuid}
                accessibilityRole="button"
                onPress={() => setExpanded(expanded === e.clientUuid ? null : e.clientUuid)}
                style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.danger, padding: t.spacing.md, minHeight: t.minTarget, justifyContent: "center" }}
              >
                <Text style={[t.text("body"), { color: t.colors.ink }]}>
                  {ENTITY_ICONS[e.entityType] ?? "📦"} {e.entityType.replace("_", " ")} · {e.op} · rejected by server
                </Text>
                {expanded === e.clientUuid && (
                  <View style={{ paddingTop: t.spacing.xs }}>
                    <Text style={[t.text("label"), { color: t.colors.danger }]}>{e.lastError}</Text>
                    <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
                      This record was not accepted. Contact your advisor to resolve it.
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[t.text("label"), { color: t.colors.inkMuted, textAlign: "center", paddingTop: t.spacing.md }]}>
          Local queue storage: {(storageUsedBytes / 1024).toFixed(0)} KB
        </Text>
      </ScrollView>
    </View>
  );
}
