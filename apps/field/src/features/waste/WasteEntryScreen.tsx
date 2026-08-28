import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { fieldTheme } from "../../theme";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { FieldNav } from "../../components/FieldNav";
import { Icon, type IconName } from "../../components/Icon";
import { outbox, syncProcessor } from "../../shared/sync";

const WASTE_TYPES: Array<{ type: string; label: string; unit: string; icon: IconName }> = [
  { type: "USED_OIL", label: "Used oil", unit: "L", icon: "droplet" },
  { type: "COOLANT", label: "Coolant", unit: "L", icon: "droplet" },
  { type: "BATTERY", label: "Battery", unit: "pcs", icon: "battery" },
  { type: "FILTER", label: "Filter", unit: "pcs", icon: "filter" },
  { type: "TIRE", label: "Tyre", unit: "pcs", icon: "circle-dot" },
];

type WasteType = (typeof WASTE_TYPES)[number]["type"];

/** F-10 — mechanic waste entry per work order: type chips, quantity + unit,
 *  56dp targets, offline-queued via the Phase-4 outbox (entityType
 *  "waste_record"). */
export function WasteEntryScreen({ workOrderId, workOrderNumber, onQueued, onBack }: { workOrderId: string; workOrderNumber?: string; onQueued?: () => void; onBack?(): void }) {
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
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Record waste" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
        {workOrderNumber && <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Work order {workOrderNumber}</Text>}

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
                <Icon name={w.icon} size={22} color={isSel ? t.colors.onPrimary : t.colors.inkMuted} />
                <Text style={{ ...t.text("h2"), color: isSel ? t.colors.onPrimary : t.colors.ink }}>{w.label}</Text>
                <Text style={{ ...t.text("label"), color: isSel ? t.colors.onPrimary : t.colors.inkMuted, marginLeft: "auto" }}>{w.unit}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <FormField accessibilityLabel="Quantity" keyboardType="decimal-pad" value={quantity} onChangeText={setQuantity} placeholder="0" />
          </View>
          <Text style={{ ...t.text("h2"), color: t.colors.inkMuted }}>{unit}</Text>
        </View>

        <Button
          accessibilityLabel="Queue waste record"
          disabled={quantity.trim() === "" || Number(quantity) <= 0}
          onPress={queue}
        >
          Save waste record
        </Button>
        {saved && <Text style={{ ...t.text("body"), color: t.colors.success }}>{saved}</Text>}
      </ScrollView>
    </View>
  );
}
