import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fieldTheme as t } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { workContent } from "../../components/FieldLayout";
import { Icon } from "../../components/Icon";
import { syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import { getBookings, manilaSchedule, type BookingBucket, type FieldTask } from "./tasksApi";

export const bookingTone = (status: string) => status === "COMPLETED" ? "success" as const : status === "NO_SHOW" ? "danger" as const : status === "CANCELLED" ? "neutral" as const : "info" as const;
export const bookingStatusLabel = (status: string) => status.toLowerCase().replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const BUCKETS: BookingBucket[] = ["today", "upcoming", "past", "all"];
export function TaskListScreen({ name, onOpenBooking, onStartInspection, active = true }: {
  name: string | null; role: string; active?: boolean;
  onOpenBooking?: (task: FieldTask) => void;
  onStartInspection?: (from: { vehicleId: string; appointmentId: string }) => void;
  onOpenSyncQueue?: () => void; onOpenRoadside?: () => void; onLogout?: () => void;
}) {
  const sync = useSyncStatus(syncProcessor);
  const [bucket, setBucket] = useState<BookingBucket>("today");
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cached, setCached] = useState<{ day: string; at: number } | null>(null);
  const generation = useRef(0);
  const load = useCallback(async (next?: string) => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const page = await getBookings(bucket, next);
      if (request !== generation.current) return;
      setTasks((old) => next ? [...old, ...page.items.filter((i) => !old.some((o) => o.id === i.id))] : page.items);
      setCursor(page.nextCursor); setCacheError(page.cacheError ?? null);
      setCached(page.stale ? { day: page.day, at: page.downloadedAt } : null);
    } catch (e) {
      if (request === generation.current) setError(e instanceof Error ? e.message : "Could not load bookings.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [bucket]);
  useFocusEffect(useCallback(() => { setTasks([]); setCursor(null); setCached(null); void load(); return () => { ++generation.current; }; }, [load]));
  useEffect(() => { if (active) void load(); }, [active, load]);
  useEffect(() => { if (sync.lastSyncAt) void load(); }, [sync.lastSyncAt, load]);
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Bookings" right={<Text style={[t.text("label"), { color: t.colors.inkMuted, paddingRight: 12 }]}>{name ?? "Staff"}</Text>} />
    <ScrollView contentContainerStyle={{ ...workContent, gap: 12 }}>
      <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Shop schedule · Philippine time</Text>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: t.colors.line }}>
        {BUCKETS.map((b) => <Pressable key={b} accessibilityRole="tab" accessibilityLabel={b[0].toUpperCase() + b.slice(1)} accessibilityState={{ selected: b === bucket }} onPress={() => setBucket(b)} style={{ flex: 1, minHeight: t.minTarget, alignItems: "center", justifyContent: "center", borderBottomWidth: 3, borderColor: bucket === b ? t.colors.primaryDeep : "transparent" }}><Text style={[t.text("label", 600), { color: bucket === b ? t.colors.primaryDeep : t.colors.inkMuted }]}>{b[0].toUpperCase() + b.slice(1)}</Text></Pressable>)}
      </View>
      {cacheError ? <Text style={[t.text("label"), { color: t.colors.danger }]}>{cacheError}</Text> : null}
      {cached ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Offline copy: {bucket}, as of {cached.day}. Downloaded {manilaSchedule(new Date(cached.at).toISOString())}. Reconnect to refresh this coverage.</Text> : null}
      {error ? <EmptyState tone="error" title="Could not refresh bookings" body={error} action={<Button variant="secondary" onPress={() => void load()}>Try again</Button>} /> : null}
      {loading && tasks.length === 0 ? <EmptyState tone="loading" title="Loading bookings…" /> : !error && tasks.length === 0 ? <EmptyState title={`No ${bucket === "all" ? "" : `${bucket} `}bookings`} body="Try another date filter. Walk-ins appear after an advisor creates their booking." /> : null}
      {tasks.map((task) => <Card key={task.id} interactive accessibilityLabel={`Open ${task.serviceTypeName} for ${task.vehiclePlateNo}`} onPress={() => onOpenBooking ? onOpenBooking(task) : onStartInspection?.({ vehicleId: task.vehicleId, appointmentId: task.id })} style={{ gap: 6, padding: 14 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <Plate variant="plain">{task.vehiclePlateNo}</Plate>
          <StatusPill tone={bookingTone(task.status)}>{bookingStatusLabel(task.status)}</StatusPill>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1, gap: 4 }}>
          <Text style={[t.text("body", 600), { color: t.colors.ink }]}>{task.serviceTypeName}</Text>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{manilaSchedule(task.scheduledStart)}</Text>
          {task.vehicleMake || task.vehicleModel ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{[task.vehicleMake, task.vehicleModel, task.vehicleYear].filter(Boolean).join(" ")}</Text> : null}
        </View><Icon name="chevron-right" size={22} color={t.colors.inkMuted} /></View>
      </Card>)}
      {cursor ? <Button variant="secondary" disabled={loading} onPress={() => void load(cursor)}>{loading ? "Loading…" : "Load more bookings"}</Button> : null}
    </ScrollView>
  </View>;
}
