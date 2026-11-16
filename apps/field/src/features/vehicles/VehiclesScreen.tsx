import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { Vehicle } from "@autocare/contracts";
import { fieldTheme as t } from "../../theme";
import { api, API_BASE_URL } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { Disclosure, IconButton, wideContent, workContent } from "../../components/FieldLayout";
import { Reference } from "../../components/References";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { Plate } from "../../components/Plate";
import { manilaSchedule } from "../tasks/tasksApi";
import { getVehicleHistory, type VehicleHistoryPoint } from "../history/historyApi";
import { syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const searchVehicles = (vehicles: Vehicle[], query: string, make = "") => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return vehicles.filter((v) => {
    const text = normalize(`${v.plateNo} ${v.make} ${v.model} ${v.year}`);
    const plate = normalize(v.plateNo).replace(/\s/g, "");
    return (!make || v.make === make) && terms.every((term) => text.includes(term) || plate.includes(term));
  });
};

export function VehiclesScreen({ onOpenVehicle, active = true }: { onOpenVehicle(vehicle: Vehicle): void; active?: boolean }) {
  const { width } = useWindowDimensions();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [view, setView] = useState<"list" | "grid">("list");
  const [count, setCount] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<number | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  useEffect(() => { let mounted = true; void kvGet("vehicle-view").then((saved) => { if (mounted && (saved === "list" || saved === "grid")) setView(saved); }); return () => { mounted = false; }; }, []);
  const load = useCallback(async () => {
    setError(null); const key = `vehicles:${API_BASE_URL}`;
    try {
      const fresh = (await api.get<Vehicle[]>("/vehicles")).filter((v) => v.status === "ACTIVE");
      await kvSet(key, JSON.stringify({ vehicles: fresh, at: Date.now() })).catch(() => undefined);
      setVehicles(fresh); setStale(null);
    } catch (e) {
      try {
        const saved = await kvGet(key);
        if (!saved) throw e;
        const data = JSON.parse(saved); setVehicles(data.vehicles); setStale(data.at);
      } catch { setError(e instanceof Error ? e.message : "Could not load registered vehicles."); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { if (active) void load(); }, [active, load]);
  const matches = searchVehicles(vehicles ?? [], query, make);
  const makes = [...new Set((vehicles ?? []).map((v) => v.make))].sort((a, b) => a.localeCompare(b));
  const changeView = (next: "list" | "grid") => { setView(next); void kvSet("vehicle-view", next).catch(() => undefined); };
  const reset = () => { setQuery(""); setMake(""); setCount(30); };
  const thumbnail = (vehicle: Vehicle, grid: boolean) => vehicle.photoUrls[0] && !failedPhotos.has(vehicle.photoUrls[0])
    ? <Image source={{ uri: vehicle.photoUrls[0] }} accessibilityLabel={`${vehicle.make} ${vehicle.model}`} onError={() => setFailedPhotos((old) => new Set([...old, vehicle.photoUrls[0]]))} style={{ width: grid ? "100%" : 48, height: grid ? 76 : 48, borderRadius: 8 }} resizeMode="cover" />
    : <View style={{ width: grid ? "100%" : 48, height: grid ? 76 : 48, backgroundColor: t.colors.surfaceSoft, alignItems: "center", justifyContent: "center", borderRadius: 8 }}><Icon name="car" size={grid ? 32 : 24} color={t.colors.inkMuted} /></View>;
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Vehicles" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={wideContent}>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.sm, backgroundColor: t.colors.surface, paddingLeft: 16 }}>
        <Icon name="search" size={20} color={t.colors.inkMuted} />
        <TextInput accessibilityLabel="Search registered vehicles" placeholder="Plate, make, model or year" placeholderTextColor={t.colors.inkMuted} autoCorrect={false} autoCapitalize="none" returnKeyType="search" value={query} onChangeText={(value) => { setQuery(value); setCount(30); }} style={{ ...t.text("body"), color: t.colors.ink, minHeight: t.minTarget, paddingHorizontal: 12, flex: 1, minWidth: 0 }} />
        {query ? <IconButton icon="x" label="Clear search" onPress={() => { setQuery(""); setCount(30); }} /> : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Button block={false} variant="secondary" icon="filter" accessibilityLabel="Filter vehicles by make" onPress={() => setFiltering(true)}>Filters{make ? " (1)" : ""}</Button>
        <View style={{ flexDirection: "row", backgroundColor: t.colors.surface, borderRadius: t.radii.sm, borderWidth: 1, borderColor: t.colors.line }}>
          <IconButton icon="list" label="List view" selected={view === "list"} onPress={() => changeView("list")} />
          <IconButton icon="layout-grid" label="Grid view" selected={view === "grid"} onPress={() => changeView("grid")} />
        </View>
      </View>
      {make || query ? <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {make ? <Button block={false} variant="secondary" icon="x" accessibilityLabel={`Remove ${make} filter`} onPress={() => { setMake(""); setCount(30); }}>{make}</Button> : null}
        <Button block={false} variant="ghost" onPress={reset}>Clear all</Button>
      </View> : null}
      {stale ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Offline copy downloaded {manilaSchedule(new Date(stale).toISOString())}. Reconnect to refresh.</Text> : null}
      {error ? <EmptyState tone="error" title="Could not load vehicles" body={error} action={<Button variant="secondary" onPress={() => void load()}>Try again</Button>} /> : vehicles === null ? <EmptyState tone="loading" title="Loading registered cars…" /> : <>
        <Text accessibilityLiveRegion="polite" style={[t.text("label"), { color: t.colors.inkMuted }]}>{matches.length} {matches.length === 1 ? "vehicle" : "vehicles"}{query || make ? " found" : " registered"}</Text>
        {matches.length === 0 ? <EmptyState title={vehicles.length === 0 ? "No registered cars" : "No matching cars"} body={vehicles.length === 0 ? "Registered active cars will appear here." : "Try another plate, make, model or year."} action={vehicles.length > 0 ? <Button variant="secondary" onPress={reset}>Clear search and filters</Button> : undefined} /> : null}
        {view === "list" ? <View testID="vehicle-list" style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.sm, borderWidth: matches.length ? 1 : 0, borderColor: t.colors.line, overflow: "hidden" }}>
          {matches.slice(0, count).map((vehicle, index) => <Pressable key={vehicle.id} accessibilityRole="button" accessibilityLabel={`Open vehicle ${vehicle.plateNo}`} onPress={() => onOpenVehicle(vehicle)} style={({ pressed }) => ({ minHeight: 96, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: index ? 1 : 0, borderColor: t.colors.lineSoft, backgroundColor: pressed ? t.colors.surfaceSoft : t.colors.surface })}>
            {thumbnail(vehicle, false)}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[t.text("code", 500), { color: t.colors.ink }]}>{vehicle.plateNo}</Text>
              <Text style={[t.text("body"), { color: t.colors.ink }]}>{vehicle.make} {vehicle.model}</Text>
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{vehicle.year}</Text>
            </View>
            {width > 600 ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{vehicle.currentOdometerKm.toLocaleString()} km</Text> : null}
            <Icon name="chevron-right" size={20} color={t.colors.inkMuted} />
          </Pressable>)}
        </View> : <View testID="vehicle-grid" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {matches.slice(0, count).map((vehicle) => <Card key={vehicle.id} interactive accessibilityLabel={`Open vehicle ${vehicle.plateNo}`} onPress={() => onOpenVehicle(vehicle)} style={{ gap: 8, padding: 12, width: width < 380 ? "100%" : width < 700 ? "48%" : 248, maxWidth: "100%" }}>
            {thumbnail(vehicle, true)}
            <Text style={[t.text("code"), { color: t.colors.ink }]}>{vehicle.plateNo}</Text>
            <Text style={[t.text("body"), { color: t.colors.ink }]}>{vehicle.make} {vehicle.model}</Text>
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{vehicle.year}</Text>
          </Card>)}
        </View>}
        {matches.length > count ? <Button variant="secondary" onPress={() => setCount(count + 30)}>Show more vehicles</Button> : null}
      </>}
    </ScrollView>
    <Modal visible={filtering} transparent animationType="none" onRequestClose={() => setFiltering(false)}>
      <View style={{ flex: 1, backgroundColor: "rgba(22,35,46,0.4)", justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => setFiltering(false)} style={{ flex: 1 }} />
        <View accessibilityViewIsModal style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%", width: "100%", maxWidth: 640, alignSelf: "center", padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}><Text style={[t.text("h2"), { color: t.colors.ink, flex: 1 }]}>Filter by make</Text><IconButton icon="x" label="Close vehicle filters" onPress={() => setFiltering(false)} /></View>
          <ScrollView>{["", ...makes].map((option) => <Pressable key={option || "all"} accessibilityRole="radio" accessibilityLabel={option || "All makes"} accessibilityState={{ checked: make === option }} onPress={() => { setMake(option); setCount(30); setFiltering(false); }} style={{ minHeight: t.minTarget, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: t.colors.lineSoft }}><Text style={[t.text("body"), { color: t.colors.ink, flex: 1 }]}>{option || "All makes"}</Text>{make === option ? <Icon name="check" size={20} color={t.colors.primaryDeep} /> : null}</Pressable>)}</ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

export function VehicleOverviewScreen({ vehicle, onBack, onOpenReport }: { vehicle: Vehicle; onBack(): void; onOpenReport(vehicleId: string, inspectionId: string): void }) {
  const sync = useSyncStatus(syncProcessor);
  const [history, setHistory] = useState<VehicleHistoryPoint[] | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { const result = await getVehicleHistory(vehicle.id); setHistory(result.history); setCachedAt(result.stale ? result.downloadedAt ?? 0 : null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load inspection history."); }
  }, [vehicle.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { if (sync.lastSyncAt) void load(); }, [sync.lastSyncAt, load]);
  const latest = history?.[0];
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    <FieldNav title="Vehicle overview" onBack={onBack} />
    <ScrollView contentContainerStyle={workContent}>
      <View style={{ gap: 6 }}><Plate variant="plain">{vehicle.plateNo}</Plate><Text style={[t.text("h2"), { color: t.colors.ink }]}>{vehicle.make} {vehicle.model}</Text><Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{vehicle.year} · {vehicle.currentOdometerKm.toLocaleString()} km</Text></View>
      {cachedAt !== null ? <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Cached history{cachedAt ? ` downloaded ${manilaSchedule(new Date(cachedAt).toISOString())}` : "; download time unavailable"}. Reconnect to refresh.</Text> : null}
      {error ? <EmptyState tone="error" title="Could not load history" body={error} action={<Button variant="secondary" onPress={() => void load()}>Try again</Button>} /> : history === null ? <EmptyState tone="loading" title="Loading health summary and inspections…" /> : history.length === 0 ? <EmptyState title="No scored inspection yet" body="Accepted reports may still be awaiting score calculation. Open the booking to check its report status." /> : <>
        <Card accent={t.vhsBands[latest!.band].fill} style={{ gap: 8 }}>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Latest health score</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}><Text style={[t.text("h1"), { fontSize: 48, color: t.vhsBands[latest!.band].text }]}>{latest!.score}<Text style={[t.text("body"), { color: t.colors.inkMuted }]}> / 100</Text></Text><Text style={[t.text("body", 600), { color: t.vhsBands[latest!.band].text }]}>{t.vhsBands[latest!.band].labelEn}</Text></View>
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{manilaSchedule(latest!.computedAt)}{latest!.isStale ? " · Score is over 90 days old" : ""}</Text>
        </Card>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Inspection history</Text>
        {history.map((h) => <Card key={h.id} interactive accessibilityLabel={`Open inspection ${manilaSchedule(h.computedAt)}, score ${h.score}`} onPress={() => onOpenReport(vehicle.id, h.inspectionId)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={[t.text("body"), { color: t.colors.ink }]}>{manilaSchedule(h.computedAt)}</Text><Text style={[t.text("label"), { color: t.vhsBands[h.band].text }]}>{t.vhsBands[h.band].labelEn}{h.isStale ? " · Stale" : ""}</Text></View><Text style={[t.text("h2"), { color: t.vhsBands[h.band].text }]}>{h.score}</Text><Icon name="chevron-right" size={20} color={t.colors.inkMuted} />
        </Card>)}
      </>}
      <Disclosure title="References"><Reference label="Vehicle ID" value={vehicle.id} /></Disclosure>
    </ScrollView>
  </View>;
}
