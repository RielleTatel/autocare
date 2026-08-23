import { ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { peso, type WorkOrder } from "./workOrderApi";

/** M-17 — service history: closed work orders as the permanent record
 *  (date, odometer, items, cost, technician summary). */
export function ServiceHistoryScreen({ workOrders, odometerByWo }: { workOrders: WorkOrder[]; odometerByWo?: Record<string, number | null> }) {
  const t = theme;
  const closed = workOrders.filter((w) => w.status === "CLOSED").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
      <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Service history</Text>
      {closed.length === 0 && <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>No completed services yet.</Text>}
      {closed.map((w) => {
        const approved = w.items.filter((i) => i.approvalStatus === "APPROVED");
        return (
          <View key={w.id} style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{w.closedAt ? new Date(w.closedAt).toLocaleDateString() : "—"}</Text>
              <Text style={{ ...t.text("body"), color: t.colors.inkMuted }} accessibilityLabel={`Work order ${w.number}`}>{w.number}</Text>
            </View>
            {odometerByWo?.[w.id] != null && <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{odometerByWo[w.id]!.toLocaleString()} km</Text>}
            {approved.map((i) => (
              <View key={i.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...t.text("body"), color: t.colors.ink, flex: 1 }}>{i.description}{i.qty > 1 ? ` ×${i.qty}` : ""}</Text>
                <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{peso(i.lineTotalCentavos)}</Text>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: t.spacing.xs, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Total</Text>
              <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{peso(w.totals.approvedCentavos)}</Text>
            </View>
            {w.technicianSummary && <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>“{w.technicianSummary}”</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}
