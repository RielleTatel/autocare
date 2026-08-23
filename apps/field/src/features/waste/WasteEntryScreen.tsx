import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { fieldTheme } from "../../theme";
import { outbox, syncProcessor } from "../../shared/sync";

const WASTE_TYPES = [
  { type: "USED_OIL", label: "Used oil", unit: "L", icon: "🛢️" },
  { type: "COOLANT", label: "Coolant", unit: "L", icon: "💧" },
  { type: "BATTERY", label: "Battery", unit: "pcs", icon: "🔋" },
  { type: "FILTER", label: "Filter", unit: "pcs", icon: "🧽" },
  { type: "TIRE", label: "Tyre", unit: "pcs", icon: "🛞" },
] as const;

type WasteType = (typeof WASTE_TYPES)[number]["type"];

/** F-10 — mechanic waste entry per work order: type chips, quantity + unit,
 *  56dp targets, offline-queued via the Phase-4 outbox (entityType
 *  "waste_record"). */
export function WasteEntryScreen({ workOrderId, workOrderNumber, onQueued }: { workOrderId: string; workOrderNumber?: string; onQueued?: () => void }) {
  const t = fieldTheme;
  const [selected, setSelected] = useState<WasteType>("USED_OIL");
  const [quantity, setQuantity] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const unit = WASTE_TYPES.find((w) => w.type === selected)!.unit;

  const queue = async () => {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return;
    await outbox.enqueue({
      clientUuid: randomUUID(),
      entityType: "waste_record",
      op: "create",
      payload: { workOrderId, wasteType: selected, quantity: qty, unit },
    });
    void syncProcessor.drain().catch(() => undefined);
    setSaved(`${qty} ${unit} ${WASTE_TYPES.find((w) => w.type === selected)!.label.toLowerCase()} queued`);
    setQuantity("");
    onQueued?.();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.chassis }} contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
      <Text style={[t.text("h1"), { color: t.colors.ink }]}>Record waste</Text>
      {workOrderNumber && <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>Work order {workOrderNumber}</Text>}

      <View style={{ gap: t.spacing.sm }}>
        {WASTE_TYPES.map((w) => {
          const isSel = selected === w.type;
          return (
            <Pressable
              key={w.type}
              accessibilityRole="button"
              accessibilityLabel={w.label}
              accessibilityState={{ selected: isSel }}
              onPress={() => setSelected(w.type)}
              style={{ minHeight: t.minTarget, borderRadius: t.radii.md, flexDirection: "row", alignItems: "center", paddingHorizontal: t.spacing.md, gap: t.spacing.sm, backgroundColor: isSel ? t.colors.primary : t.colors.surface, borderWidth: 1, borderColor: isSel ? t.colors.primary : t.colors.line }}
            >
              <Text style={{ fontSize: 24 }}>{w.icon}</Text>
              <Text style={[t.text("h2"), { color: isSel ? t.colors.onPrimary : t.colors.ink }]}>{w.label}</Text>
              <Text style={[t.text("label"), { color: isSel ? t.colors.onPrimary : t.colors.inkMuted, marginLeft: "auto" }]}>{w.unit}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
        <TextInput
          accessibilityLabel="Quantity"
          keyboardType="decimal-pad"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0"
          style={{ flex: 1, minHeight: t.minTarget, borderWidth: 1, borderColor: t.colors.line, borderRadius: t.radii.md, backgroundColor: t.colors.surface, paddingHorizontal: t.spacing.md, fontSize: 28, color: t.colors.ink }}
        />
        <Text style={[t.text("h2"), { color: t.colors.inkMuted }]}>{unit}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Queue waste record"
        disabled={quantity.trim() === "" || Number(quantity) <= 0}
        onPress={queue}
        style={{ minHeight: t.minTarget, borderRadius: t.radii.md, alignItems: "center", justifyContent: "center", backgroundColor: quantity.trim() === "" || Number(quantity) <= 0 ? t.colors.line : t.colors.primary }}
      >
        <Text style={[t.text("h2"), { color: "#FFFFFF" }]}>Save waste record</Text>
      </Pressable>
      {saved && <Text style={[t.text("body"), { color: t.colors.success }]}>{saved}</Text>}
    </ScrollView>
  );
}
