import { VehicleDiagram } from "./VehicleDiagram";
import type { ShapeId } from "./diagramGeometry";
import type { InspectionResultDetail } from "./healthScoreApi";

export type VehicleDiagram3DProps = {
  viewportHeight?: number;
  results: InspectionResultDetail[];
  onShapePress?: (id: ShapeId) => void;
  onError: (error: Error) => void;
  onLoading?: () => void;
  onReady?: () => void;
};

/** Browser/base entry keeps the native graphics runtime out of web bundles. */
export function VehicleDiagram3D({ results, onShapePress }: VehicleDiagram3DProps) {
  return <VehicleDiagram results={results} onShapePress={onShapePress} />;
}
