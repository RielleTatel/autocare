import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Vehicle } from "@autocare/contracts";
import { fieldTheme as t } from "../theme";
import { Icon, type IconName } from "../components/Icon";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { FieldNav } from "../components/FieldNav";
import { Disclosure, workContent } from "../components/FieldLayout";
import { Reference } from "../components/References";
import { TaskListScreen } from "../features/tasks/TaskListScreen";
import type { FieldTask } from "../features/tasks/tasksApi";
import { VehiclesScreen } from "../features/vehicles/VehiclesScreen";
import { RoadsideContainer } from "../features/roadside/RoadsideContainer";
import { syncProcessor } from "../shared/sync";
import { useSyncStatus } from "../shared/sync/useSyncStatus";

type Tab = "Bookings" | "Vehicles" | "Roadside" | "More";
export function tabsForRole(role: string): Tab[] {
  if (role === "DRIVER") return ["Vehicles", "Roadside", "More"];
  if (role === "MECHANIC") return ["Bookings", "Vehicles", "More"];
  if (role === "ADMIN" || role === "ADVISOR") return ["Bookings", "Vehicles", "Roadside", "More"];
  return ["More"];
}
const icons: Record<Tab, IconName> = { Bookings: "clipboard-list", Vehicles: "car", Roadside: "truck", More: "more-horizontal" };
export function FieldHome({ staffId, name, role, onOpenBooking, onOpenVehicle, onOpenSyncQueue, onLogout }: {
  staffId: string; name: string | null; role: string; onOpenBooking(task: FieldTask): void;
  onOpenVehicle(vehicle: Vehicle): void; onOpenSyncQueue(): void; onLogout(): void;
}) {
  const insets = useSafeAreaInsets();
  const tabs = tabsForRole(role);
  const [tab, setTab] = useState<Tab>(role === "DRIVER" ? "Roadside" : tabs[0]);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [visited, setVisited] = useState<Set<Tab>>(new Set([tab]));
  const sync = useSyncStatus(syncProcessor);
  const select = (next: Tab) => { setTab(next); setVisited((old) => new Set([...old, next])); };
  return <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
    {tabs.includes("Bookings") && visited.has("Bookings") ? <View style={{ flex: 1, display: tab === "Bookings" ? "flex" : "none" }}><TaskListScreen name={name} role={role} onOpenBooking={onOpenBooking} active={tab === "Bookings"} /></View> : null}
    {tabs.includes("Vehicles") && visited.has("Vehicles") ? <View style={{ flex: 1, display: tab === "Vehicles" ? "flex" : "none" }}><VehiclesScreen onOpenVehicle={onOpenVehicle} active={tab === "Vehicles"} /></View> : null}
    {tab === "Roadside" && tabs.includes("Roadside") ? <RoadsideContainer userId={staffId} role={role} /> : null}
    {tab === "More" ? <View style={{ flex: 1 }}>
      <FieldNav title="More" />
      <ScrollView contentContainerStyle={workContent}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>{name ?? "Staff account"}</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>{role.charAt(0) + role.slice(1).toLowerCase()}</Text>
        <Card interactive accessibilityLabel="Open sync queue" onPress={onOpenSyncQueue} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Icon name="refresh-cw" color={t.colors.inkMuted} /><View style={{ flex: 1, gap: 4 }}><Text style={[t.text("body", 600), { color: t.colors.ink }]}>Sync queue</Text><Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{sync.pendingCount} pending · {sync.rejectedCount} need attention</Text></View><Icon name="chevron-right" size={20} color={t.colors.inkMuted} /></Card>
        <Disclosure title="Account references"><Reference label="Staff ID" value={staffId} /></Disclosure>
        {confirmLogout ? <Card style={{ gap: 12 }}>
          <Text style={[t.text("h2"), { color: t.colors.ink }]}>Sign out of this device?</Text>
          <Text style={[t.text("body"), { color: sync.pendingCount ? t.colors.danger : t.colors.inkMuted }]}>{sync.pendingCount ? `${sync.pendingCount} entries have not synced. Saved work stays on this device for this account; sign in again to continue.` : "Your saved work stays on this device for this account."}</Text>
          <Button variant="danger" testID="staff-logout-confirm" onPress={onLogout}>Sign out</Button>
          <Button variant="secondary" onPress={() => setConfirmLogout(false)}>Stay signed in</Button>
        </Card> : <Button variant="ghost" testID="staff-logout" onPress={() => setConfirmLogout(true)}>Sign out</Button>}
      </ScrollView>
    </View> : null}
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderTopWidth: 1, borderColor: t.colors.line, backgroundColor: t.colors.surface, paddingBottom: Math.max(8, insets.bottom), paddingTop: 6 }}>
      {tabs.map((destination) => <Pressable key={destination} accessibilityRole="tab" accessibilityLabel={destination} accessibilityState={{ selected: tab === destination }} onPress={() => select(destination)} style={{ flex: 1, minHeight: t.minTarget, gap: 4, alignItems: "center", justifyContent: "center", borderTopWidth: 3, borderColor: tab === destination ? t.colors.primary : "transparent" }}>
        <Icon name={icons[destination]} size={24} color={tab === destination ? t.colors.primary : t.colors.inkMuted} />
        <Text style={[t.text("label"), { color: tab === destination ? t.colors.primary : t.colors.inkMuted }]}>{destination}</Text>
      </Pressable>)}
    </View>
  </View>;
}
