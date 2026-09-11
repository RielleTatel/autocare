import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { Band } from "@autocare/scoring";
import { vhsBands } from "@autocare/design-tokens";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { getVehicleHistory, type VehicleHistoryPoint } from "./historyApi";

const manilaDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" });

/**
 * Prior inspections for the vehicle about to be worked on — the point of
 * reference the field app previously had no way to show. Most recent first.
 *
 * Deliberately quiet: this sits above a primary action, so while it loads and
 * when a vehicle has never been inspected it renders nothing at all rather than
 * a spinner or an empty-state that competes with "Begin inspection".
 */
export function VehicleHistory({
  vehicleId,
  onOpenInspection,
}: {
  vehicleId: string;
  onOpenInspection?: (inspectionId: string) => void;
}) {
  const t = fieldTheme;
  const [history, setHistory] = useState<VehicleHistoryPoint[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let mounted = true;
    getVehicleHistory(vehicleId)
      .then(({ history: h, stale: s }) => { if (mounted) { setHistory(h); setStale(s); } })
      .catch(() => undefined); // reference data: never surface over the task
    return () => { mounted = false; };
  }, [vehicleId]);

  if (history.length === 0) return null;

  const [latest, ...previous] = history;
  const latestBand = vhsBands[latest.band as Band];

  return (
    <View style={{ gap: t.spacing.xs }}>
      <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Previous inspections</Text>
      {stale ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Showing the last downloaded copy.</Text>
      ) : null}

      <Card
        accent={latestBand.fill}
        interactive={!!onOpenInspection}
        accessibilityLabel={`Most recent inspection ${manilaDate(latest.computedAt)}, score ${latest.score}`}
        onPress={onOpenInspection ? () => onOpenInspection(latest.inspectionId) : undefined}
      >
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Most recent</Text>
        <Text style={{ ...t.text("h1"), color: latestBand.text }}>
          {latest.score} · {latestBand.labelEn}
        </Text>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
          {manilaDate(latest.computedAt)}
          {latest.odometerKm !== null ? ` · ${latest.odometerKm.toLocaleString("en-PH")} km` : ""}
          {latest.isStale ? " · stale" : ""}
        </Text>
      </Card>

      {previous.map((h) => {
        const band = vhsBands[h.band as Band];
        return (
          <Card
            key={h.id}
            interactive={!!onOpenInspection}
            accessibilityLabel={`Inspection ${manilaDate(h.computedAt)}, score ${h.score}`}
            onPress={onOpenInspection ? () => onOpenInspection(h.inspectionId) : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}
          >
            <Text style={{ ...t.text("h2"), color: band.text }}>{h.score}</Text>
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted, flex: 1 }}>
              {band.labelEn} · {manilaDate(h.computedAt)}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}
