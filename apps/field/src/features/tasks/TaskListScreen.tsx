import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { SyncBanner } from "../../shared/SyncBanner";
import { syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import { getTodaysTasks, type FieldTask } from "./tasksApi";

type Tone = "neutral" | "info" | "success" | "warn" | "danger";

/** Appointment lifecycle → pill tone. Mirrors the mockup's STATUS_TONE. */
const STATUS_TONE: Record<string, Tone> = {
  BOOKED: "info",
  CONFIRMED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", hour12: true });

const manilaDay = () =>
  new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" });

/** F-01 — the mechanic's day. Work is listed in start order; the two standing
 *  actions sit under it. */
export function TaskListScreen({
  name, role, onStartInspection, onOpenSyncQueue,
}: {
  name: string | null;
  role: string;
  /** Called with the booking's context when started from a task card, and with
   *  nothing for a walk-in (the technician then picks the vehicle by plate). An
   *  object rather than positional args so adding context can't silently shift. */
  onStartInspection?: (from?: { vehicleId: string; appointmentId: string }) => void;
  onOpenSyncQueue?: () => void;
}) {
  const t = fieldTheme;
  const sync = useSyncStatus(syncProcessor);
  const [tasks, setTasks] = useState<FieldTask[] | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { tasks: fresh, stale: isStale } = await getTodaysTasks();
      setTasks(fresh);
      setStale(isStale);
    } catch {
      setTasks(null);
      setFailed(true);
    }
  }, []);

  // On focus, not just on mount: returning from a finished inspection reuses
  // this screen instance, so a plain useEffect would re-render the same stale
  // list and the task would still look outstanding.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // A sync landing while this screen is open is the other moment the board
  // changes underneath us — that is when the appointment flips to COMPLETED.
  useEffect(() => { if (sync.lastSyncAt) void load(); }, [sync.lastSyncAt, load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav
        title={`Today · ${manilaDay()}`}
        right={
          <Text style={{ ...t.text("label"), color: t.colors.inkMuted, paddingRight: t.spacing.sm }}>
            {role.charAt(0) + role.slice(1).toLowerCase()} · {name ?? "Staff"}
          </Text>
        }
      />
      <SyncBanner
        pendingCount={sync.pendingCount}
        rejectedCount={sync.rejectedCount}
        lastError={sync.lastError}
        onPress={onOpenSyncQueue}
      />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        {stale ? (
          <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
            Showing the last list downloaded — reconnect to refresh it.
          </Text>
        ) : null}

        {failed ? (
          <EmptyState
            tone="error"
            title="Could not load today's work"
            body="You are offline and this device has not downloaded a list yet."
            action={<Button variant="secondary" icon="refresh-cw" onPress={() => void load()}>Try again</Button>}
          />
        ) : tasks === null ? (
          <EmptyState tone="loading" title="Loading today's work…" />
        ) : tasks.length === 0 ? (
          <EmptyState title="Nothing booked today" body="Walk-ins will appear here once an advisor books them." />
        ) : (
          tasks.map((task) => (
            <Card key={task.id} interactive onPress={() => onStartInspection?.({ vehicleId: task.vehicleId, appointmentId: task.id })} accessibilityLabel={`Open ${task.serviceTypeName} for ${task.vehiclePlateNo}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
                <Text style={{ ...t.text("code"), color: t.colors.ink }}>{manilaTime(task.scheduledStart)}</Text>
                <Plate variant="plain">{task.vehiclePlateNo}</Plate>
                <View style={{ flex: 1 }} />
                <StatusPill tone={STATUS_TONE[task.status] ?? "neutral"}>{task.status.replace("_", " ")}</StatusPill>
              </View>
              <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{task.serviceTypeName}</Text>
              {task.memberName ? (
                <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{task.memberName}</Text>
              ) : null}
            </Card>
          ))
        )}

        <Button icon="wrench" onPress={() => onStartInspection?.()} style={{ marginTop: t.spacing.sm }}>
          Start inspection
        </Button>
        <Button variant="secondary" icon="refresh-cw" onPress={onOpenSyncQueue}>
          {sync.pendingCount > 0 ? `Sync queue (${sync.pendingCount})` : "Sync queue"}
        </Button>
      </ScrollView>
    </View>
  );
}
