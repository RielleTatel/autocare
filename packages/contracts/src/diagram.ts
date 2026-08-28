import { z } from "zod";

/**
 * Where a checklist point physically sits on the vehicle.
 *
 * A zone is SEMANTIC (what the data knows). The member app maps zones onto
 * drawable shapes, which is a separate, presentational concern — one zone may
 * light several shapes (AXLE_FRONT lights both front wheels) and one shape may
 * belong to several zones (a front wheel is in WHEEL_FL, AXLE_FRONT and
 * CORNERS_ALL). A shape renders the worst status among its zones.
 *
 * `null` on a point is a first-class answer meaning "position unknown" — see
 * the authoring rule in the design spec. Never guess a position.
 */
export const DIAGRAM_ZONES = [
  "WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR",
  "AXLE_FRONT", "AXLE_REAR", "CORNERS_ALL",
  "ENGINE_BAY", "CABIN", "UNDERBODY", "BODY_SHELL",
  "LIGHTS_FRONT", "LIGHTS_REAR", "LIGHTS_ALL",
] as const;

export const diagramZoneSchema = z.enum(DIAGRAM_ZONES);
export type DiagramZone = z.infer<typeof diagramZoneSchema>;
