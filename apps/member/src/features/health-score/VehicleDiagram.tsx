import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { theme } from "../../theme";
import { statusColor } from "./statusColor";
import { zoneStatuses } from "./zoneStatus";
import { DIAGRAM_VIEWBOX, SHAPES, shapeStatuses, type ShapeId } from "./diagramGeometry";
import type { InspectionResultDetail } from "./healthScoreApi";

/**
 * M-39 — the vehicle diagram. Presentational: it takes inspection results and
 * emits taps, and fetches nothing itself.
 *
 * A shape with no scored points renders in the GOOD colour rather than being
 * hidden, so the car always reads as a whole car.
 */
export function VehicleDiagram({
  results,
  onShapePress,
}: {
  results: Pick<InspectionResultDetail, "diagramZone" | "status">[];
  onShapePress?: (id: ShapeId) => void;
}) {
  const byShape = shapeStatuses(zoneStatuses(results));

  return (
    <View accessibilityLabel="Vehicle condition diagram" style={{ alignItems: "center" }}>
      <Svg viewBox={DIAGRAM_VIEWBOX} width="100%" height={340}>
        {SHAPES.map((s) => (
          <Path
            key={s.id}
            testID={`zone-${s.id}`}
            d={s.d}
            fill={statusColor(byShape[s.id] ?? "GOOD")}
            stroke={theme.colors.line}
            strokeWidth={1.5}
            opacity={s.id === "BODY_SHELL" ? 0.35 : 1}
            accessibilityRole="button"
            accessibilityLabel={s.label}
            onPress={onShapePress ? () => onShapePress(s.id) : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}
