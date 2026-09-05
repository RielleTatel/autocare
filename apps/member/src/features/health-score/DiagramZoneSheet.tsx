import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";
import { BottomSheet } from "../../components/BottomSheet";
import { statusColor } from "./statusColor";
import { SHAPES, zonesForShape, type ShapeId } from "./diagramGeometry";
import type { InspectionResultDetail } from "./healthScoreApi";

/**
 * M-40 — what sits at a tapped part of the car.
 *
 * The grouped-zone design means one region can hold several categories: the
 * engine bay holds Engine, Battery and Fluids. This sheet is where that gets
 * disambiguated. Each row hands off to the existing ExplainSheet rather than
 * re-implementing explanation text.
 */
export function DiagramZoneSheet({
  shapeId,
  results,
  onClose,
  onSelectPoint,
}: {
  shapeId: ShapeId | null;
  results: InspectionResultDetail[];
  onClose: () => void;
  onSelectPoint?: (result: InspectionResultDetail) => void;
}) {
  const t = theme;
  if (!shapeId) return null;

  const shape = SHAPES.find((s) => s.id === shapeId);
  const zones = new Set<string>(zonesForShape(shapeId));
  const inZone = results.filter((r) => r.diagramZone && zones.has(r.diagramZone));

  return (
    <BottomSheet title={shape?.label ?? "Vehicle area"} onClose={onClose}>
      {inZone.length === 0 ? (
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
          Nothing was recorded for this part of your vehicle in the last inspection.
        </Text>
      ) : (
        inZone.map((r) => (
          <Pressable
            key={r.pointCode}
            testID={`zone-point-${r.pointCode}`}
            accessibilityRole="button"
            accessibilityLabel={`Explain ${r.label}`}
            onPress={() => onSelectPoint?.(r)}
            style={{
              minHeight: t.minTarget,
              flexDirection: "row",
              alignItems: "center",
              gap: t.spacing.sm,
              paddingVertical: t.spacing.sm,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: statusColor(r.status ?? "GOOD"),
              }}
            />
            <Text style={{ ...t.text("body"), color: t.colors.ink, flex: 1 }}>{r.label}</Text>
          </Pressable>
        ))
      )}
    </BottomSheet>
  );
}
