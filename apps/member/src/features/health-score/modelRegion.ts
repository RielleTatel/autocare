import { SHAPES, type ShapeId } from "./diagramGeometry";

const REGIONS = new Set<string>(SHAPES.map((shape) => shape.id));
type ModelNode = { name: string; userData?: Record<string, unknown>; parent: ModelNode | null };

/** GLTFLoader may split a region into child meshes for each material primitive. */
export function modelRegion(node: ModelNode | null): ShapeId | undefined {
  for (let current = node; current; current = current.parent) {
    const id = current.userData?.regionId;
    if (typeof id === "string" && REGIONS.has(id)) return id as ShapeId;
    if (REGIONS.has(current.name)) return current.name as ShapeId;
  }
  return undefined;
}
