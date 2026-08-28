# 2D Vehicle Diagram — Design

**Date:** 2026-08-28
**Requirements:** FR-116, FR-117 · **Screens:** M-39, M-40
**Status:** Approved design, ready for implementation planning

## 1. Purpose

Give members a top-down illustration of their vehicle whose regions are colour-coded by
inspection status, so the Vehicle Health Score answers *"what needs attention, and roughly
where"* rather than only *"what needs attention"*.

This is a presentation layer over data that already exists. It changes no scoring
mathematics, and cannot alter any historical score (NFR-055).

## 2. Background

`13 Constraints and Risks` rejected the original photorealistic 3D concept as infeasible and
chose a 2D diagram, deferring it to v1.1. That document states the hook
`checklist_points.diagram_zone_id` is "reserved so v1.1 is cheap".

**That field was never actually added.** It does not exist in `schema.prisma`, in
`packages/contracts`, or anywhere in the codebase. Creating it is part of this work, not a
precondition of it. Everything else the roadmap claims is in place genuinely is: the ten VHS
categories, per-point statuses, band colour tokens, and the tap-to-explain sheet.

### Library survey (concluded: build, do not adopt)

No library supplies what this needs.

| Candidate | Verdict |
|---|---|
| `react-svg-map`, `react-image-mapper`, `react-simple-maps` | React DOM only; unusable in React Native |
| `react-native-image-mapper` | Only RN option; pins `react@16.8.3` / `react-native@0.59.8` vs our 19.2.3 / 0.86.2. Abandoned 2022 |
| npm packages for vehicle diagrams | None exist (`car-damage-diagram`, `vehicle-diagram` → 404) |
| Stock vehicle artwork | Assets, not components — usable as a base silhouette only |

`react-native-svg` 15.15.4 is **already a dependency** and supports `onPress` per `<Path>`,
which is the entire interactive requirement. The base silhouette is adapted from a CC0
public-domain top-down car vector (freesvg.org / SVG Repo / Openclipart — CC0 permits
commercial use without attribution). Only the zone overlay geometry is hand-authored.

## 3. The core constraint

The ten VHS categories do not have ten distinct physical locations. Mapped onto a top-down
car, **79 of the 100 total category weight collapses onto two places**:

| Location | Categories | Weight |
|---|---|---|
| Engine bay | Engine & Drivetrain (18), Battery & Electrical (11), Fluids (11) | **40** |
| The four corners | Brakes (16), Tyres & Wheels (14), Suspension & Steering (9) | **39** |
| Front/rear ends | Lights & Visibility (7) | 7 |
| Cabin | Sensors & Electronics (5) | 5 |
| Underside | Emissions Systems (5) | 5 |
| Whole shell | Body & Undercarriage (4) | 4 |

Positional precision also varies *within* a category. Of 50 checklist points, only four carry
true per-corner data:

| Granularity | Count | Points |
|---|---|---|
| Per-corner | 4 | `TREAD_FL` `TREAD_FR` `TREAD_RL` `TREAD_RR` |
| Per-axle | 2 | `BRAKE_PAD_FRONT` `BRAKE_PAD_REAR` |
| Vehicle-level | 44 | all others |

The design must therefore let coarse and fine positional data coexist without either
fabricating precision or hiding data.

## 4. Zones and shapes

Two distinct concepts, deliberately separated:

- A **zone** is semantic — where a checklist point physically is. Stored in the database.
- A **shape** is visual — one drawable path in the SVG. Lives only in the app.

The relationship is many-to-many. A shape's fill is the **worst status among every zone that
touches it**. This is what allows `SHOCKS` (no known corner) and `TREAD_FL` (an exact corner)
to colour the same illustration coherently.

### Zone vocabulary — `@autocare/contracts`

| Zone | Shapes it lights |
|---|---|
| `WHEEL_FL` `WHEEL_FR` `WHEEL_RL` `WHEEL_RR` | that single wheel |
| `AXLE_FRONT` | both front wheels |
| `AXLE_REAR` | both rear wheels |
| `CORNERS_ALL` | all four wheels |
| `ENGINE_BAY` | bonnet region |
| `CABIN` | cabin region |
| `UNDERBODY` | underside / exhaust region |
| `BODY_SHELL` | whole outline |
| `LIGHTS_FRONT` | front light strip |
| `LIGHTS_REAR` | rear light strip |
| `LIGHTS_ALL` | both light strips |

### Authoring rule

> Map a point to a zone only when its physical position is unambiguous. Otherwise `null`.

`null` is a first-class, correct answer. `TYRE_PRESSURE_DEV` names no corner; guessing one
would be a fabrication on a screen members rely on for safety decisions. Unmapped points
remain fully visible in the list view — the diagram never becomes the only path to a finding.

### Complete point → zone mapping

| Category | Point | Zone |
|---|---|---|
| ENGINE | `ENGINE_IDLE` | `ENGINE_BAY` |
| ENGINE | `ENGINE_NOISE` | `ENGINE_BAY` |
| ENGINE | `DRIVE_BELTS` | `ENGINE_BAY` |
| ENGINE | `ENGINE_LEAKS` | `ENGINE_BAY` |
| ENGINE | `ENGINE_MOUNTS` | `ENGINE_BAY` |
| ENGINE | `TRANSMISSION_SHIFT` | `UNDERBODY` |
| ENGINE | `CLUTCH_OPERATION` | `UNDERBODY` |
| BRAKES | `BRAKE_PAD_FRONT` | `AXLE_FRONT` |
| BRAKES | `BRAKE_PAD_REAR` | `AXLE_REAR` |
| BRAKES | `PARKING_BRAKE` | `AXLE_REAR` |
| BRAKES | `BRAKE_FLUID_MOISTURE` | `ENGINE_BAY` |
| BRAKES | `BRAKE_DISC_CONDITION` | `null` — no axle specified |
| TYRES | `TREAD_FL` | `WHEEL_FL` |
| TYRES | `TREAD_FR` | `WHEEL_FR` |
| TYRES | `TREAD_RL` | `WHEEL_RL` |
| TYRES | `TREAD_RR` | `WHEEL_RR` |
| TYRES | `TYRE_PRESSURE_DEV` | `null` — no corner specified |
| TYRES | `WHEEL_CONDITION` | `null` — no corner specified |
| BATTERY | `BATTERY_VOLTAGE` | `ENGINE_BAY` |
| BATTERY | `CHARGING_OUTPUT` | `ENGINE_BAY` |
| BATTERY | `TERMINALS` | `ENGINE_BAY` |
| BATTERY | `WIRING_VISIBLE` | `ENGINE_BAY` |
| FLUIDS | `ENGINE_OIL_LEVEL` | `ENGINE_BAY` |
| FLUIDS | `COOLANT_LEVEL` | `ENGINE_BAY` |
| FLUIDS | `BRAKE_FLUID_LEVEL` | `ENGINE_BAY` |
| FLUIDS | `ATF_CONDITION` | `ENGINE_BAY` |
| FLUIDS | `PS_FLUID` | `ENGINE_BAY` |
| FLUIDS | `WASHER_FLUID` | `ENGINE_BAY` |
| SUSP | `SHOCKS` | `CORNERS_ALL` |
| SUSP | `BUSHINGS` | `CORNERS_ALL` |
| SUSP | `BALL_JOINTS` | `CORNERS_ALL` |
| SUSP | `ALIGNMENT_PULL` | `CORNERS_ALL` |
| SUSP | `STEERING_LINKAGE` | `AXLE_FRONT` |
| LIGHTS | `HEADLIGHTS` | `LIGHTS_FRONT` |
| LIGHTS | `BRAKE_LIGHTS` | `LIGHTS_REAR` |
| LIGHTS | `TURN_SIGNALS` | `LIGHTS_ALL` |
| LIGHTS | `WIPERS` | `CABIN` |
| LIGHTS | `WINDSCREEN` | `CABIN` |
| LIGHTS | `HORN` | `null` — not meaningfully locatable |
| EMISSIONS | `O2_SENSOR_SWITCHING` | `UNDERBODY` |
| EMISSIONS | `CATALYST_READINESS` | `UNDERBODY` |
| EMISSIONS | `EXHAUST_ABNORMALITY` | `UNDERBODY` |
| SENSORS | `AIRBAG_WARNING_LIGHT` | `CABIN` |
| SENSORS | `DASH_WARNING_LIGHTS` | `CABIN` |
| SENSORS | `CRUISE_CONTROL` | `CABIN` |
| SENSORS | `SENSOR_WIRING` | `CABIN` |
| BODY | `RUST_UNDERCARRIAGE` | `UNDERBODY` |
| BODY | `BODY_PANELS` | `BODY_SHELL` |
| BODY | `DOORS_LOCKS` | `BODY_SHELL` |
| BODY | `INTERIOR` | `CABIN` |

All 50 points are accounted for above. Four are intentionally `null`:
`BRAKE_DISC_CONDITION`, `TYRE_PRESSURE_DEV`, `WHEEL_CONDITION`, `HORN`.

## 5. Architecture

### Storage

`ChecklistPoint` gains `diagramZoneId String?` (`@map("diagram_zone_id")`). Nullable and
additive, so the migration cannot affect existing scoring or score reproducibility.

Zone values are authored in `packages/scoring/src/seed-config.ts` beside the points
themselves — the file the codebase already treats as the single authoring point for checklist
config — and written by the existing `seed-checklist.ts`.

Rationale for storing in the database rather than as an app-side constant: checklist points
are admin-editable versioned configuration (FR-100, FR-101). A zone that lived only in the
app could not follow a point an administrator adds later without an app release. A point's
physical location is a fact about the point, not about its presentation.

### API

No new endpoint. `InspectionResultDetail` gains one field:

```ts
diagramZone: DiagramZone | null;
```

`GET /vehicles/:vehicleId/inspections/:inspectionId` already returns these rows and is already
called by the member app, so the diagram needs no additional round trip.

### Client components — `apps/member/src/features/health-score/`

| Module | Responsibility | Depends on |
|---|---|---|
| `diagramGeometry.ts` | Static zone → SVG path data; the traced CC0 silhouette | nothing |
| `zoneStatus.ts` | **Pure**: `results[] → Record<DiagramZone, PointStatus>` | `@autocare/scoring` types only |
| `VehicleDiagram.tsx` | Presentational SVG; props in, `onZonePress` out | the two above |
| `DiagramZoneSheet.tsx` | M-40: lists the categories/points in a tapped zone | existing `ExplainSheet` |
| `HealthScoreScreen.tsx` | Gains a Diagram / List view toggle | above |

`zoneStatus.ts` is deliberately free of React and SVG so the only genuinely intricate logic —
worst-status resolution — is unit-testable without a renderer.

### Colour

Status maps to band via the aliases the design system already defines in
`packages/design-tokens` (`--ac-sev-critical` → `band-critical`, `--ac-sev-attention` →
`band-needs-attention`, `--ac-sev-monitor` → `band-fair`), then to a fill through
`vhsBands[band].fill`. **No new palette is introduced.** The existing status→band helper
currently inlined in `ExplainSheet.tsx` is extracted so the sheet and the diagram cannot drift
apart.

## 6. Data flow

```
GET /vehicles/:id/health-score        → score, categoryScores, inspectionId
GET /vehicles/:id/inspections/:iid    → results[] { pointCode, status, categoryCode, diagramZone }
                                             │
                        zoneStatus.ts        ▼
              group by diagramZone → worst status per zone   (drops null + NOT_APPLICABLE)
                                             │
                     diagramGeometry.ts      ▼
              zone → shapes; each shape takes the worst status across its zones
                                             │
                                             ▼
                    fill = vhsBands[bandForStatus(status)].fill
```

Tapping a shape resolves to the zones covering it, and `DiagramZoneSheet` lists every category
and point mapped there. Each row opens the existing `ExplainSheet`, so explanation text,
thresholds, and photos are inherited rather than reimplemented.

## 7. Error handling and edge cases

| Case | Behaviour |
|---|---|
| Vehicle has no inspection yet | Neutral car plus empty state; not an error |
| Point with `diagramZone = null` | Not drawn; remains visible in list view |
| `NOT_APPLICABLE` point | Excluded from zone status, matching the scoring engine |
| Zone with no applicable points | Rendered neutral, not tappable |
| Stale score (> 90 days) | Inherits the existing stale presentation; no second staleness concept |
| Unknown zone string from a newer checklist | Ignored; must never crash the screen |
| Historical inspections predating this change | All zones `null` → neutral diagram, list view unaffected |

That last row is a deliberate accepted consequence: previously published checklist versions
are immutable, so their points genuinely carry no position. Rendering them neutral is honest;
back-filling would invent data.

## 8. Testing

| Test | Asserts |
|---|---|
| `zoneStatus.test.ts` | Worst-of resolution across overlapping zones; `null` and `NOT_APPLICABLE` exclusion; empty input |
| `VehicleDiagram.test.tsx` | Renders a shape per zone; `onZonePress` fires with the correct zone |
| `DiagramZoneSheet.test.tsx` | Lists exactly the points mapped to the tapped zone |
| API test | `diagramZone` present on inspection result rows |
| Seed test | Every zone in `seed-config` is a valid `DiagramZone` — permanently catches typos |
| Existing suites | `HealthScoreScreen` and `ExplainSheet` tests still pass unchanged |

## 9. Out of scope

Per-make/model artwork · any mechanic-facing annotation tool (the field app keeps the
structured checklist) · admin UI for editing zone assignments · zoom, pan, or animation ·
any web-console diagram · back-filling zones onto historical checklist versions.

## 10. Consequences to accept

1. The diagram is neutral for inspections taken against checklist versions published before
   this change. Correct, but visible to members with older inspections.
2. Four points are intentionally unlocatable and appear only in list view.
3. Suspension points tint all four corners, which is honest about the data's precision but
   less visually specific than tyre tread.
