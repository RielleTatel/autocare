import { DIAGRAM_ZONES, type DiagramZone } from "@autocare/contracts";
import type { PointStatus } from "@autocare/scoring";
import { worstStatus } from "./zoneStatus";

/**
 * A schematic top-down car. Deliberately angular and generic: the spec rejected
 * per-make/model artwork, and the goal is "what needs attention, and roughly
 * where" — not photorealism. Adapted from a CC0 public-domain silhouette.
 *
 * Geometry is presentational and lives only in the app. Zones (the semantic
 * "where is this point") live in the database. One zone may light several
 * shapes and one shape may belong to several zones.
 */
export const DIAGRAM_VIEWBOX = "0 0 200 400";

export type ShapeId =
  | "BODY_SHELL" | "ENGINE_BAY" | "CABIN" | "UNDERBODY"
  | "LIGHTS_FRONT" | "LIGHTS_REAR"
  | "WHEEL_FL" | "WHEEL_FR" | "WHEEL_RL" | "WHEEL_RR";

export const SHAPES: readonly { id: ShapeId; d: string; label: string }[] = [
  { id: "BODY_SHELL",    label: "Body and undercarriage", d: "M 70 20 L 130 20 L 150 60 L 155 200 L 152 330 L 140 375 L 60 375 L 48 330 L 45 200 L 50 60 Z" },
  { id: "ENGINE_BAY",    label: "Engine bay",             d: "M 62 45 L 138 45 L 145 120 L 55 120 Z" },
  { id: "CABIN",         label: "Cabin",                  d: "M 57 130 L 143 130 L 145 240 L 55 240 Z" },
  { id: "UNDERBODY",     label: "Underbody",              d: "M 55 250 L 145 250 L 142 350 L 58 350 Z" },
  { id: "LIGHTS_FRONT",  label: "Front lights",           d: "M 68 22 L 132 22 L 136 36 L 64 36 Z" },
  { id: "LIGHTS_REAR",   label: "Rear lights",            d: "M 62 358 L 138 358 L 136 372 L 64 372 Z" },
  { id: "WHEEL_FL",      label: "Front-left wheel",       d: "M 22 85 L 46 85 L 46 140 L 22 140 Z" },
  { id: "WHEEL_FR",      label: "Front-right wheel",      d: "M 154 85 L 178 85 L 178 140 L 154 140 Z" },
  { id: "WHEEL_RL",      label: "Rear-left wheel",        d: "M 22 265 L 46 265 L 46 320 L 22 320 Z" },
  { id: "WHEEL_RR",      label: "Rear-right wheel",       d: "M 154 265 L 178 265 L 178 320 L 154 320 Z" },
] as const;

export const ZONE_SHAPES: Record<DiagramZone, readonly ShapeId[]> = {
  WHEEL_FL: ["WHEEL_FL"],
  WHEEL_FR: ["WHEEL_FR"],
  WHEEL_RL: ["WHEEL_RL"],
  WHEEL_RR: ["WHEEL_RR"],
  AXLE_FRONT: ["WHEEL_FL", "WHEEL_FR"],
  AXLE_REAR: ["WHEEL_RL", "WHEEL_RR"],
  CORNERS_ALL: ["WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR"],
  ENGINE_BAY: ["ENGINE_BAY"],
  CABIN: ["CABIN"],
  UNDERBODY: ["UNDERBODY"],
  BODY_SHELL: ["BODY_SHELL"],
  LIGHTS_FRONT: ["LIGHTS_FRONT"],
  LIGHTS_REAR: ["LIGHTS_REAR"],
  LIGHTS_ALL: ["LIGHTS_FRONT", "LIGHTS_REAR"],
};

/** Every zone that covers a shape — used to build the tapped-zone sheet. */
export function zonesForShape(id: ShapeId): DiagramZone[] {
  return DIAGRAM_ZONES.filter((z) => ZONE_SHAPES[z].includes(id));
}

/** Project zone statuses onto shapes, each shape taking the worst it inherits. */
export function shapeStatuses(
  zones: Partial<Record<DiagramZone, PointStatus>>,
): Partial<Record<ShapeId, PointStatus>> {
  const out: Partial<Record<ShapeId, PointStatus>> = {};
  for (const zone of DIAGRAM_ZONES) {
    const status = zones[zone];
    if (!status) continue;
    for (const shapeId of ZONE_SHAPES[zone]) {
      out[shapeId] = worstStatus(out[shapeId], status);
    }
  }
  return out;
}
