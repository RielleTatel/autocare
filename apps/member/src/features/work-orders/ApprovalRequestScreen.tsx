import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { peso, type WorkOrder, type WorkOrderItem } from "./workOrderApi";

type Decision = "APPROVED" | "DECLINED" | "DEFERRED";
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: theme.vhsBands.CRITICAL.fill,
  ATTENTION: theme.vhsBands.NEEDS_ATTENTION.fill,
  MONITOR: theme.vhsBands.FAIR.fill,
};

/** M-25 — member approval request. Each line: plain-language description,
 *  price, severity chip, Approve / Decline / Defer; running approved total;
 *  confirm sends every decision atomically. */
export function ApprovalRequestScreen({
  workOrder, onSubmit,
}: {
  workOrder: WorkOrder;
  onSubmit: (decisions: Array<{ itemId: string; decision: Decision }>) => Promise<void>;
}) {
  const t = theme;
  const decidable = workOrder.items.filter((i) => i.approvalStatus === "PENDING" || i.approvalStatus === "APPROVED" || i.approvalStatus === "DECLINED" || i.approvalStatus === "DEFERRED");
  const [choices, setChoices] = useState<Record<string, Decision>>(() => {
    const init: Record<string, Decision> = {};
    for (const i of decidable) if (i.approvalStatus !== "PENDING") init[i.id] = i.approvalStatus as Decision;
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvedTotal = useMemo(
    () => decidable.filter((i) => choices[i.id] === "APPROVED").reduce((s, i) => s + i.lineTotalCentavos, 0),
    [choices, decidable],
  );
  const allDecided = decidable.every((i) => choices[i.id]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(decidable.map((i) => ({ itemId: i.id, decision: choices[i.id] })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit decisions");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Approve your service</Text>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
          Work order {workOrder.number}. Decide each item below — approve what you want done, decline or defer the rest.
        </Text>

        {decidable.map((i) => (
          <LineCard key={i.id} item={i} choice={choices[i.id]} onChoose={(d) => setChoices((c) => ({ ...c, [i.id]: d }))} />
        ))}

        {error && <Text style={{ ...t.text("body"), color: t.colors.danger }}>{error}</Text>}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: t.colors.line, backgroundColor: t.colors.surface, padding: t.spacing.md, gap: t.spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Approved total</Text>
          <Text testID="approved-total" style={{ ...t.text("h2"), color: t.colors.ink }}>{peso(approvedTotal)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm decisions"
          accessibilityState={{ disabled: !allDecided || busy }}
          disabled={!allDecided || busy}
          onPress={submit}
          style={{ minHeight: t.minTarget, borderRadius: t.radii.md, alignItems: "center", justifyContent: "center", backgroundColor: allDecided && !busy ? t.colors.primary : t.colors.line }}
        >
          <Text style={{ ...t.text("h2"), color: "#FFFFFF" }}>{busy ? "Sending…" : "Confirm decisions"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LineCard({ item, choice, onChoose }: { item: WorkOrderItem; choice: Decision | undefined; onChoose: (d: Decision) => void }) {
  const t = theme;
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.md, borderWidth: 1, borderColor: t.colors.line, padding: t.spacing.md, gap: t.spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
        {item.severity && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SEVERITY_COLOR[item.severity] ?? t.colors.inkMuted }} />}
        <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{item.recommendationLabel ?? item.description}</Text>
        <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{peso(item.lineTotalCentavos)}</Text>
      </View>
      {item.recommendationLabel && item.description !== item.recommendationLabel && (
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{item.description}</Text>
      )}
      <View style={{ flexDirection: "row", gap: t.spacing.xs }}>
        {(["APPROVED", "DEFERRED", "DECLINED"] as const).map((d) => {
          const selected = choice === d;
          const color = d === "APPROVED" ? t.colors.success : d === "DECLINED" ? t.colors.danger : t.colors.inkMuted;
          const label = d === "APPROVED" ? "Approve" : d === "DECLINED" ? "Decline" : "Defer";
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item.recommendationLabel ?? item.description}`}
              accessibilityState={{ selected }}
              onPress={() => onChoose(d)}
              style={{ flex: 1, minHeight: t.minTarget, borderRadius: t.radii.md, alignItems: "center", justifyContent: "center", backgroundColor: selected ? color : t.colors.surface, borderWidth: 1, borderColor: selected ? color : t.colors.line }}
            >
              <Text style={{ ...t.text("body"), color: selected ? "#FFFFFF" : t.colors.ink }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
