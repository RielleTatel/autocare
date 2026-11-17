import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";
import { BottomSheet } from "../../components/BottomSheet";
import { Icon } from "../../components/Icon";
import { FindingExplanation, type ExplainTarget } from "./ExplainSheet";
import { effectiveStatus, statusLabel, zoneStatuses } from "./zoneStatus";
import { statusColor } from "./statusColor";
import { SHAPES, shapeStatuses, zonesForShape, type ShapeId } from "./diagramGeometry";
import type { InspectionResultDetail } from "./healthScoreApi";

const STATUS_ORDER: (PointStatus | undefined)[] = ["CRITICAL", "ATTENTION", "MONITOR", "GOOD", undefined, "NOT_APPLICABLE"];
const SHARED_SCOPE: Record<string, string> = {
  AXLE_FRONT: "Both front wheels", AXLE_REAR: "Both rear wheels", CORNERS_ALL: "All four corners", LIGHTS_ALL: "All lights",
};

/** Region findings and their explanations share one native modal. */
export function DiagramZoneSheet({ shapeId, results, onClose, onSelectPoint, chooseRegion = false, onSelectRegion }: {
  chooseRegion?: boolean;
  onSelectRegion?: (id: ShapeId) => void;
  shapeId: ShapeId | null;
  results: InspectionResultDetail[];
  onClose: () => void;
  onSelectPoint?: (result: InspectionResultDetail) => void;
}) {
  const t = theme;
  const [selected, setSelected] = useState<InspectionResultDetail | null>(null);
  useEffect(() => setSelected(null), [shapeId, results]);
  if (!shapeId && !chooseRegion) return null;
  const byShape = shapeStatuses(zoneStatuses(results));
  const shape = SHAPES.find(s => s.id === shapeId);
  const zones = new Set<string>(shapeId ? zonesForShape(shapeId) : []);
  const inZone = results.filter(r => r.diagramZone && zones.has(r.diagramZone));
  const thresholds = selected?.thresholds;
  const target: ExplainTarget | null = selected ? {
    point: {
      code: selected.pointCode, label: selected.label, unit: selected.unit ?? undefined,
      templates: selected.templates ?? undefined,
      thresholds: thresholds && (thresholds.direction === "HIGHER_BETTER" || thresholds.direction === "LOWER_BETTER")
        ? { ...thresholds, direction: thresholds.direction } : undefined,
    },
    status: effectiveStatus(selected), measuredValue: selected.measuredValue ?? undefined,
    photoUrl: selected.photoUrls?.[0],
  } : null;
  return (
    <BottomSheet title={selected?.label ?? shape?.label ?? "Choose a region"} contentKey={selected?.pointCode ?? shapeId ?? "regions"} onClose={onClose} closeLabel="Close">
      {!shapeId ? SHAPES.map(region => {
        const regionZones = new Set(zonesForShape(region.id));
        const matching = results.filter(r => r.diagramZone && regionZones.has(r.diagramZone));
        const label = byShape[region.id] ? statusLabel(byShape[region.id]) : matching.length === 0 ? "No findings recorded" : matching.every(r => effectiveStatus(r) === "NOT_APPLICABLE") ? "Not applicable" : "Status unavailable";
        return <Pressable key={region.id} testID={`region-${region.id}`} accessibilityRole="button" accessibilityLabel={`${region.label}: ${label}`}
          onPress={() => onSelectRegion?.(region.id)} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.lineSoft }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ ...t.text("body"), color: t.colors.ink }}>{region.label}</Text><Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{label}</Text></View>
          <Icon name="chevron-right" size={16} color={t.colors.inkMuted} />
        </Pressable>;
      }) : target ? <>
        <Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={{ minHeight: t.minTarget, flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
          <Icon name="chevron-left" color={t.colors.primary} />
          <Text style={{ ...t.text("body", 600), color: t.colors.primary }}>Back to {shape?.label ?? "region"}</Text>
        </Pressable>
        <Text style={{ ...t.text("label"), color: t.colors.ink }}>{statusLabel(target.status)}</Text>
        <FindingExplanation target={target} />
      </> : inZone.length === 0 ? (
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Nothing was recorded for this part of your vehicle in the last inspection.</Text>
      ) : <>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>Select a finding to see its explanation.</Text>
        {STATUS_ORDER.map(status => {
          const rows = inZone.filter(r => effectiveStatus(r) === status);
          if (!rows.length) return null;
          return <View key={status ?? "unknown"} style={{ marginTop: t.spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(status) }} />
              <Text accessibilityRole="header" style={{ ...t.text("body", 600), color: t.colors.ink }}>{statusLabel(status)} ({rows.length})</Text>
            </View>
            {rows.map(r => <Pressable key={r.pointCode} testID={`zone-point-${r.pointCode}`} accessibilityRole="button"
              accessibilityLabel={`Explain ${r.label}, ${statusLabel(status)}${r.diagramZone && SHARED_SCOPE[r.diagramZone] ? `, ${SHARED_SCOPE[r.diagramZone]}` : ""}`}
              onPress={() => onSelectPoint ? onSelectPoint(r) : setSelected(r)}
              style={{ minHeight: t.minTarget, paddingVertical: t.spacing.sm, flexDirection: "row", alignItems: "center", gap: t.spacing.sm, borderBottomWidth: 1, borderBottomColor: t.colors.lineSoft }}>
              <View style={{ flex: 1, gap: t.spacing.xs }}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>{r.label}</Text>
                {!!(r.diagramZone && SHARED_SCOPE[r.diagramZone]) && <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{SHARED_SCOPE[r.diagramZone!]}</Text>}
              </View>
              <Icon name="chevron-right" size={16} color={t.colors.inkMuted} />
            </Pressable>)}
          </View>;
        })}
      </>}
    </BottomSheet>
  );
}
