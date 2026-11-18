import { useEffect, useState } from "react";
import { Text, View } from "react-native";
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

  const latestFull = history.find((entry) => entry.scope === "FULL");

  return (
    <View style={{ gap: t.spacing.xs }}>
      <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Previous inspections</Text>
      {stale ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Showing the last downloaded copy.</Text>
      ) : null}

      <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{latestFull ? `Last full inspection: ${manilaDate(latestFull.computedAt)}` : "No confirmed full inspection yet."}</Text>
      {history.map((h) => {
        const band = h.scope === "FULL" && h.band ? vhsBands[h.band] : null;
        const scope = h.scope === "FULL" ? "Full inspection" : h.scope === "FOCUSED" ? "Focused inspection" : "Legacy inspection · scope unknown";
        return (
          <Card
            key={h.id}
            interactive={!!onOpenInspection}
            accent={band?.fill}
            accessibilityLabel={`${scope}, ${manilaDate(h.computedAt)}`}
            onPress={onOpenInspection ? () => onOpenInspection(h.inspectionId) : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}
          >
            {h.scope === "FULL" && h.score != null ? <Text style={{ ...t.text("h2"), color: band?.text ?? t.colors.ink }}>{h.score}</Text> : null}
            <View style={{ flex: 1, gap: 4 }}><Text style={{ ...t.text("body", 600), color: t.colors.ink }}>{h.serviceName ?? h.templateName ?? scope}</Text><Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{scope} · {manilaDate(h.computedAt)}</Text></View>
          </Card>
        );
      })}
    </View>
  );
}
