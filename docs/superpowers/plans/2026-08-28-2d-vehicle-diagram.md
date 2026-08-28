# 2D Vehicle Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give members a top-down vehicle illustration whose regions are colour-coded by inspection status, tappable through to the existing explanation sheet.

**Architecture:** A nullable `diagramZoneId` on `ChecklistPoint` records where a checklist point physically sits. The member app maps those semantic zones onto drawable SVG shapes (many-to-many), colouring each shape by the worst status among the zones touching it. No scoring logic changes; no new API endpoint.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, NestJS, React Native (Expo), `react-native-svg` 15.15.4 (already a dependency), Zod, vitest (packages), jest (apps).

**Spec:** `docs/superpowers/specs/2026-08-28-2d-vehicle-diagram-design.md`

## Global Constraints

- The checklist point total is **50**, across 10 categories. Four points are intentionally unmapped: `BRAKE_DISC_CONDITION`, `TYRE_PRESSURE_DEV`, `WHEEL_CONDITION`, `HORN`.
- `diagramZoneId` is **nullable and additive**. It must never affect scoring output or break score reproducibility (NFR-055).
- **No new colour palette.** Status colours come from `theme.vhsBands[band].fill` via the shared helper built in Task 5.
- `NOT_APPLICABLE` points are excluded from zone status, matching the scoring engine.
- A point with a `null` zone is never drawn on the diagram but **must remain visible in list view** — the diagram is never the only path to a finding.
- Unknown zone strings from a newer checklist version must be ignored gracefully, never crash.
- Test commands: packages use `pnpm --filter <pkg> test` (vitest); apps use `pnpm --filter <app> test` (jest).
- Branch: `feat-2d-vehicle-diagram` (already created; the spec is committed there).

---

### Task 1: Zone vocabulary in contracts

**Files:**
- Create: `packages/contracts/src/diagram.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/diagram.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `DiagramZone` (union type), `diagramZoneSchema` (Zod enum), `DIAGRAM_ZONES` (readonly array of all 14 zone strings)

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/diagram.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { diagramZoneSchema, DIAGRAM_ZONES } from "./diagram";

describe("diagramZoneSchema", () => {
  it("accepts every declared zone", () => {
    for (const zone of DIAGRAM_ZONES) {
      expect(diagramZoneSchema.parse(zone)).toBe(zone);
    }
  });

  it("rejects an unknown zone", () => {
    expect(() => diagramZoneSchema.parse("BOOT_LID")).toThrow();
  });

  it("declares exactly the fourteen zones the diagram can draw", () => {
    expect(DIAGRAM_ZONES).toHaveLength(14);
    expect([...DIAGRAM_ZONES].sort()).toEqual([
      "AXLE_FRONT", "AXLE_REAR", "BODY_SHELL", "CABIN", "CORNERS_ALL",
      "ENGINE_BAY", "LIGHTS_ALL", "LIGHTS_FRONT", "LIGHTS_REAR",
      "UNDERBODY", "WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR",
    ].sort());
  });
});
```

The fourteen are: four wheels, two axles, corners-all, four regions, three light groups.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/contracts test`
Expected: FAIL — cannot resolve `./diagram`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/contracts/src/diagram.ts`:

```ts
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
```

Add to `packages/contracts/src/index.ts`:

```ts
export * from "./diagram";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autocare/contracts test`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/diagram.ts packages/contracts/src/diagram.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add DiagramZone vocabulary for the vehicle diagram"
```

---

### Task 2: Database column for the zone

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `ChecklistPoint`, around line 616-642)
- Create: migration under `apps/api/prisma/migrations/`

**Interfaces:**
- Consumes: nothing
- Produces: `ChecklistPoint.diagramZoneId: string | null` in the Prisma client

- [ ] **Step 1: Add the column to the schema**

In `apps/api/prisma/schema.prisma`, inside `model ChecklistPoint`, add this line directly after `notApplicableWhen`:

```prisma
  // Where this point physically sits on the vehicle (FR-116). Nullable: a point
  // whose position is ambiguous stays null rather than being guessed. Values are
  // the DiagramZone union in @autocare/contracts.
  diagramZoneId          String?             @map("diagram_zone_id")
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
cd apps/api && npx prisma migrate dev --name add_checklist_point_diagram_zone
```
Expected: a new migration folder containing `ALTER TABLE "checklist_points" ADD COLUMN "diagram_zone_id" TEXT;`

- [ ] **Step 3: Verify the column is additive and nullable**

Run:
```bash
grep -r "diagram_zone_id" apps/api/prisma/migrations/
```
Expected: exactly one `ADD COLUMN` line, with **no** `NOT NULL` and **no** `DEFAULT`. If either appears, the migration would rewrite existing rows — fix the schema and regenerate.

- [ ] **Step 4: Confirm existing scoring tests still pass**

Run: `pnpm --filter api test -- src/modules/inspections`
Expected: PASS, unchanged. The column is additive, so scoring must be untouched.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add nullable diagram_zone_id to checklist_points"
```

---

### Task 3: Author the zone for every checklist point

**Files:**
- Modify: `packages/scoring/src/types.ts` (the `ConfigPoint` type)
- Modify: `packages/scoring/src/seed-config.ts` (the `PointDef` type at ~line 25-31, the `pt()` helper at line 32, and all 50 point definitions)
- Modify: `apps/api/prisma/seed-checklist.ts` (the `checklistPoint.create` call)
- Test: `packages/scoring/src/diagram-zones.test.ts`

**Interfaces:**
- Consumes: `DiagramZone` from Task 1
- Produces: `ConfigPoint.diagramZone?: DiagramZone` — read by the seed in this task and asserted by the test

- [ ] **Step 1: Write the failing test**

Create `packages/scoring/src/diagram-zones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DIAGRAM_ZONES } from "@autocare/contracts";
import { seedConfig } from "./seed-config";

const allPoints = seedConfig.categories.flatMap((c) => c.points);

// The four points whose position is genuinely ambiguous. Guessing a position for
// these would fabricate precision on a screen members use for safety decisions.
const INTENTIONALLY_UNMAPPED = [
  "BRAKE_DISC_CONDITION", "TYRE_PRESSURE_DEV", "WHEEL_CONDITION", "HORN",
];

describe("checklist point diagram zones", () => {
  it("covers all 50 points", () => {
    expect(allPoints).toHaveLength(50);
  });

  it("assigns only valid zones", () => {
    for (const p of allPoints) {
      if (p.diagramZone != null) {
        expect(DIAGRAM_ZONES).toContain(p.diagramZone);
      }
    }
  });

  it("leaves exactly the ambiguous points unmapped", () => {
    const unmapped = allPoints.filter((p) => p.diagramZone == null).map((p) => p.code).sort();
    expect(unmapped).toEqual([...INTENTIONALLY_UNMAPPED].sort());
  });

  it("gives each tyre tread point its own corner", () => {
    const byCode = Object.fromEntries(allPoints.map((p) => [p.code, p.diagramZone]));
    expect(byCode.TREAD_FL).toBe("WHEEL_FL");
    expect(byCode.TREAD_FR).toBe("WHEEL_FR");
    expect(byCode.TREAD_RL).toBe("WHEEL_RL");
    expect(byCode.TREAD_RR).toBe("WHEEL_RR");
  });

  it("maps brake pads per axle, not per corner", () => {
    const byCode = Object.fromEntries(allPoints.map((p) => [p.code, p.diagramZone]));
    expect(byCode.BRAKE_PAD_FRONT).toBe("AXLE_FRONT");
    expect(byCode.BRAKE_PAD_REAR).toBe("AXLE_REAR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/scoring test -- diagram-zones`
Expected: FAIL — `diagramZone` does not exist on the point type.

- [ ] **Step 3: Add the field to the types**

In `packages/scoring/src/types.ts`, add to `ConfigPoint`:

```ts
  diagramZone?: DiagramZone;
```

and import it at the top of the file:

```ts
import type { DiagramZone } from "@autocare/contracts";
```

In `packages/scoring/src/seed-config.ts`, add to the `PointDef` type (around line 30):

```ts
  zone?: DiagramZone;
```

import it at the top:

```ts
import type { DiagramZone } from "@autocare/contracts";
```

and pass it through in `pt()` (line 32-43), adding one line to the returned object:

```ts
    diagramZone: d.zone,
```

- [ ] **Step 4: Assign a zone to every point**

In `packages/scoring/src/seed-config.ts`, add `zone:` to each `pt({...})` call using this exact mapping. Four points get no `zone` key at all.

| Point | add |
|---|---|
| `ENGINE_IDLE` `ENGINE_NOISE` `DRIVE_BELTS` `ENGINE_LEAKS` `ENGINE_MOUNTS` | `zone: "ENGINE_BAY"` |
| `TRANSMISSION_SHIFT` `CLUTCH_OPERATION` | `zone: "UNDERBODY"` |
| `BRAKE_PAD_FRONT` | `zone: "AXLE_FRONT"` |
| `BRAKE_PAD_REAR` `PARKING_BRAKE` | `zone: "AXLE_REAR"` |
| `BRAKE_FLUID_MOISTURE` | `zone: "ENGINE_BAY"` |
| `BRAKE_DISC_CONDITION` | *(omit — no axle specified)* |
| `TREAD_FL` | `zone: "WHEEL_FL"` |
| `TREAD_FR` | `zone: "WHEEL_FR"` |
| `TREAD_RL` | `zone: "WHEEL_RL"` |
| `TREAD_RR` | `zone: "WHEEL_RR"` |
| `TYRE_PRESSURE_DEV` `WHEEL_CONDITION` | *(omit — no corner specified)* |
| `BATTERY_VOLTAGE` `CHARGING_OUTPUT` `TERMINALS` `WIRING_VISIBLE` | `zone: "ENGINE_BAY"` |
| `ENGINE_OIL_LEVEL` `COOLANT_LEVEL` `BRAKE_FLUID_LEVEL` `ATF_CONDITION` `PS_FLUID` `WASHER_FLUID` | `zone: "ENGINE_BAY"` |
| `SHOCKS` `BUSHINGS` `BALL_JOINTS` `ALIGNMENT_PULL` | `zone: "CORNERS_ALL"` |
| `STEERING_LINKAGE` | `zone: "AXLE_FRONT"` |
| `HEADLIGHTS` | `zone: "LIGHTS_FRONT"` |
| `BRAKE_LIGHTS` | `zone: "LIGHTS_REAR"` |
| `TURN_SIGNALS` | `zone: "LIGHTS_ALL"` |
| `WIPERS` `WINDSCREEN` | `zone: "CABIN"` |
| `HORN` | *(omit — not meaningfully locatable)* |
| `O2_SENSOR_SWITCHING` `CATALYST_READINESS` `EXHAUST_ABNORMALITY` | `zone: "UNDERBODY"` |
| `AIRBAG_WARNING_LIGHT` `DASH_WARNING_LIGHTS` `CRUISE_CONTROL` `SENSOR_WIRING` | `zone: "CABIN"` |
| `RUST_UNDERCARRIAGE` | `zone: "UNDERBODY"` |
| `BODY_PANELS` `DOORS_LOCKS` | `zone: "BODY_SHELL"` |
| `INTERIOR` | `zone: "CABIN"` |

Example of the edited form:

```ts
pt({ code: "TREAD_FL", label: "Front-left tyre tread", labelFil: "Tread ng gulong sa harap-kaliwa", w: 20, sc: true, thresholds: TREAD, unit: "mm", zone: "WHEEL_FL", rec: "Replace the front-left tyre — tread is below the safe minimum." }),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @autocare/scoring test -- diagram-zones`
Expected: PASS (5 tests)

- [ ] **Step 6: Persist the zone in the seed**

In `apps/api/prisma/seed-checklist.ts`, inside the `tx.checklistPoint.create({ data: { ... } })` call, add:

```ts
            diagramZoneId: p.diagramZone ?? null,
```

- [ ] **Step 7: Verify the whole scoring suite is unaffected**

Run: `pnpm --filter @autocare/scoring test`
Expected: PASS — including the golden and reproducibility suites. Adding a presentational field must not move a single score.

- [ ] **Step 8: Commit**

```bash
git add packages/scoring/src apps/api/prisma/seed-checklist.ts
git commit -m "feat(scoring): assign diagram zones to all 50 checklist points"
```

---

### Task 4: Return the zone from the API

**Files:**
- Modify: `apps/api/src/modules/inspections/inspections.service.ts:90-110`
- Modify: `apps/member/src/features/health-score/healthScoreApi.ts` (the `InspectionResultDetail` type)
- Test: `apps/api/src/modules/inspections/inspections.service.spec.ts`

**Interfaces:**
- Consumes: `ChecklistPoint.diagramZoneId` from Task 2
- Produces: `InspectionResultDetail.diagramZone: DiagramZone | null` — the field every client task reads

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/inspections/inspections.service.spec.ts`, inside the existing top-level `describe`:

```ts
  it("returns the diagram zone on each inspection result", async () => {
    const detail = await service.inspectionDetail(member, vehicleId, inspectionId);
    const tread = detail.results.find((r) => r.pointCode === "TREAD_FL");
    expect(tread?.diagramZone).toBe("WHEEL_FL");
  });

  it("returns null for a point with no unambiguous position", async () => {
    const detail = await service.inspectionDetail(member, vehicleId, inspectionId);
    const wheel = detail.results.find((r) => r.pointCode === "WHEEL_CONDITION");
    expect(wheel?.diagramZone).toBeNull();
  });
```

Reuse whatever fixture variables (`service`, `member`, `vehicleId`, `inspectionId`) the surrounding suite already sets up; do not invent new ones. If the existing suite names the method differently, match it — check the method name at `inspections.service.ts:80`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- inspections.service`
Expected: FAIL — `diagramZone` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/modules/inspections/inspections.service.ts`, inside the `inspection.results.map((r) => ({ ... }))` block, add after `categoryCode`:

```ts
        diagramZone: (r.point.diagramZoneId ?? null) as DiagramZone | null,
```

and import the type at the top of the file:

```ts
import type { DiagramZone } from "@autocare/contracts";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- inspections.service`
Expected: PASS

- [ ] **Step 5: Mirror the field on the client type**

In `apps/member/src/features/health-score/healthScoreApi.ts`, add to `InspectionResultDetail`:

```ts
  diagramZone: DiagramZone | null;
```

and import it:

```ts
import type { DiagramZone } from "@autocare/contracts";
```

- [ ] **Step 6: Typecheck both sides**

Run: `pnpm --filter api typecheck && pnpm --filter member typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/inspections apps/member/src/features/health-score/healthScoreApi.ts
git commit -m "feat(api): return diagramZone on inspection result details"
```

---

### Task 5: Extract the shared status colour helper

**Files:**
- Create: `apps/member/src/features/health-score/statusColor.ts`
- Modify: `apps/member/src/features/health-score/HealthScoreScreen.tsx:16-23`
- Test: `apps/member/src/features/health-score/statusColor.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `statusColor(status: PointStatus | string): string` — used by Tasks 8 and 9

This is a pure refactor: `HealthScoreScreen.tsx` already contains exactly this function as a private `severityColor`. Extracting it prevents the diagram from growing a second, drifting copy.

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/health-score/statusColor.test.ts`:

```ts
import { statusColor } from "./statusColor";
import { theme } from "../../theme";

describe("statusColor", () => {
  it("maps each adverse status to its band fill", () => {
    expect(statusColor("CRITICAL")).toBe(theme.vhsBands.CRITICAL.fill);
    expect(statusColor("ATTENTION")).toBe(theme.vhsBands.NEEDS_ATTENTION.fill);
    expect(statusColor("MONITOR")).toBe(theme.vhsBands.FAIR.fill);
  });

  it("falls back to muted ink for GOOD, NOT_APPLICABLE and unknown values", () => {
    expect(statusColor("GOOD")).toBe(theme.colors.inkMuted);
    expect(statusColor("NOT_APPLICABLE")).toBe(theme.colors.inkMuted);
    expect(statusColor("SOMETHING_NEW")).toBe(theme.colors.inkMuted);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- statusColor`
Expected: FAIL — cannot resolve `./statusColor`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/member/src/features/health-score/statusColor.ts`:

```ts
import type { PointStatus } from "@autocare/scoring";
import { theme } from "../../theme";

/**
 * Point status → band fill. Extracted from HealthScoreScreen so the detractor
 * cards, the diagram, and the zone sheet cannot drift apart.
 *
 * The status→band pairing is the design system's own severity alias set
 * (--ac-sev-critical → band-critical, etc). Do not introduce a second palette.
 * Unknown values fall back to muted ink so a newer checklist can never crash
 * an older app.
 */
export function statusColor(status: PointStatus | string): string {
  switch (status) {
    case "CRITICAL": return theme.vhsBands.CRITICAL.fill;
    case "ATTENTION": return theme.vhsBands.NEEDS_ATTENTION.fill;
    case "MONITOR": return theme.vhsBands.FAIR.fill;
    default: return theme.colors.inkMuted;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- statusColor`
Expected: PASS (2 tests)

- [ ] **Step 5: Replace the private copy in HealthScoreScreen**

In `apps/member/src/features/health-score/HealthScoreScreen.tsx`, delete the local `severityColor` function (lines 16-23) and import the shared one:

```ts
import { statusColor } from "./statusColor";
```

Then replace every `severityColor(` call site in that file with `statusColor(`.

- [ ] **Step 6: Confirm the screen's existing tests still pass**

Run: `pnpm --filter member test -- HealthScoreScreen`
Expected: PASS, unchanged — this is a behaviour-preserving refactor.

- [ ] **Step 7: Commit**

```bash
git add apps/member/src/features/health-score/statusColor.ts apps/member/src/features/health-score/statusColor.test.ts apps/member/src/features/health-score/HealthScoreScreen.tsx
git commit -m "refactor(member): extract shared statusColor helper"
```

---

### Task 6: Zone status resolution (pure logic)

**Files:**
- Create: `apps/member/src/features/health-score/zoneStatus.ts`
- Test: `apps/member/src/features/health-score/zoneStatus.test.ts`

**Interfaces:**
- Consumes: `DiagramZone` (Task 1), `InspectionResultDetail` (Task 4)
- Produces:
  - `worstStatus(a: PointStatus | undefined, b: PointStatus | undefined): PointStatus | undefined`
  - `zoneStatuses(results: Pick<InspectionResultDetail, "diagramZone" | "status">[]): Partial<Record<DiagramZone, PointStatus>>`

This module is deliberately free of React and SVG. It holds the only genuinely intricate logic in the feature, so it must be testable without a renderer.

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/health-score/zoneStatus.test.ts`:

```ts
import { zoneStatuses, worstStatus } from "./zoneStatus";

const r = (diagramZone: any, status: any) => ({ diagramZone, status });

describe("worstStatus", () => {
  it("ranks CRITICAL above ATTENTION above MONITOR above GOOD", () => {
    expect(worstStatus("GOOD", "MONITOR")).toBe("MONITOR");
    expect(worstStatus("MONITOR", "ATTENTION")).toBe("ATTENTION");
    expect(worstStatus("ATTENTION", "CRITICAL")).toBe("CRITICAL");
  });

  it("returns whichever side is defined when the other is missing", () => {
    expect(worstStatus(undefined, "GOOD")).toBe("GOOD");
    expect(worstStatus("ATTENTION", undefined)).toBe("ATTENTION");
    expect(worstStatus(undefined, undefined)).toBeUndefined();
  });
});

describe("zoneStatuses", () => {
  it("keeps the worst status per zone", () => {
    const out = zoneStatuses([
      r("ENGINE_BAY", "GOOD"),
      r("ENGINE_BAY", "CRITICAL"),
      r("ENGINE_BAY", "MONITOR"),
    ]);
    expect(out.ENGINE_BAY).toBe("CRITICAL");
  });

  it("keeps zones independent", () => {
    const out = zoneStatuses([r("WHEEL_FL", "CRITICAL"), r("WHEEL_FR", "GOOD")]);
    expect(out.WHEEL_FL).toBe("CRITICAL");
    expect(out.WHEEL_FR).toBe("GOOD");
  });

  it("ignores points with no zone", () => {
    const out = zoneStatuses([r(null, "CRITICAL")]);
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("excludes NOT_APPLICABLE, matching the scoring engine", () => {
    const out = zoneStatuses([r("CABIN", "NOT_APPLICABLE")]);
    expect(out.CABIN).toBeUndefined();
  });

  it("ignores a result whose status has not been recorded", () => {
    const out = zoneStatuses([r("CABIN", null)]);
    expect(out.CABIN).toBeUndefined();
  });

  it("ignores an unknown zone from a newer checklist without throwing", () => {
    expect(() => zoneStatuses([r("BOOT_LID", "CRITICAL")])).not.toThrow();
    expect(zoneStatuses([r("BOOT_LID", "CRITICAL")] as any)).toEqual({});
  });

  it("returns an empty map for no results", () => {
    expect(zoneStatuses([])).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- zoneStatus`
Expected: FAIL — cannot resolve `./zoneStatus`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/member/src/features/health-score/zoneStatus.ts`:

```ts
import { DIAGRAM_ZONES, type DiagramZone } from "@autocare/contracts";
import type { PointStatus } from "@autocare/scoring";
import type { InspectionResultDetail } from "./healthScoreApi";

/** Higher wins. NOT_APPLICABLE is absent on purpose — it never colours a zone. */
const SEVERITY: Record<string, number> = {
  GOOD: 0, MONITOR: 1, ATTENTION: 2, CRITICAL: 3,
};

const KNOWN_ZONES = new Set<string>(DIAGRAM_ZONES);

export function worstStatus(
  a: PointStatus | undefined,
  b: PointStatus | undefined,
): PointStatus | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return (SEVERITY[a] ?? -1) >= (SEVERITY[b] ?? -1) ? a : b;
}

/**
 * Collapse inspection results into one status per zone, keeping the worst.
 *
 * Dropped on purpose: points with no zone (position unknown — they stay visible
 * in list view instead), NOT_APPLICABLE points (excluded from scoring too), and
 * unrecorded statuses. Unknown zone strings are ignored rather than thrown on,
 * so an app can safely render an inspection from a newer checklist version.
 */
export function zoneStatuses(
  results: Pick<InspectionResultDetail, "diagramZone" | "status">[],
): Partial<Record<DiagramZone, PointStatus>> {
  const out: Partial<Record<DiagramZone, PointStatus>> = {};
  for (const r of results) {
    const zone = r.diagramZone;
    if (!zone || !KNOWN_ZONES.has(zone)) continue;
    const status = r.status;
    if (!status || SEVERITY[status] === undefined) continue;
    out[zone] = worstStatus(out[zone], status);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- zoneStatus`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/health-score/zoneStatus.ts apps/member/src/features/health-score/zoneStatus.test.ts
git commit -m "feat(member): resolve worst inspection status per diagram zone"
```

---

### Task 7: Diagram geometry and zone→shape mapping

**Files:**
- Create: `apps/member/src/features/health-score/diagramGeometry.ts`
- Test: `apps/member/src/features/health-score/diagramGeometry.test.ts`

**Interfaces:**
- Consumes: `DiagramZone` (Task 1), `zoneStatuses` output (Task 6)
- Produces:
  - `DIAGRAM_VIEWBOX: string`
  - `type ShapeId`
  - `SHAPES: readonly { id: ShapeId; d: string; label: string }[]`
  - `ZONE_SHAPES: Record<DiagramZone, readonly ShapeId[]>`
  - `shapeStatuses(zones: Partial<Record<DiagramZone, PointStatus>>): Partial<Record<ShapeId, PointStatus>>`
  - `zonesForShape(id: ShapeId): DiagramZone[]`

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/health-score/diagramGeometry.test.ts`:

```ts
import { DIAGRAM_ZONES } from "@autocare/contracts";
import { SHAPES, ZONE_SHAPES, shapeStatuses, zonesForShape } from "./diagramGeometry";

describe("diagram geometry", () => {
  it("gives every zone at least one shape", () => {
    for (const zone of DIAGRAM_ZONES) {
      expect(ZONE_SHAPES[zone].length).toBeGreaterThan(0);
    }
  });

  it("only references shapes that exist", () => {
    const ids = new Set(SHAPES.map((s) => s.id));
    for (const zone of DIAGRAM_ZONES) {
      for (const shapeId of ZONE_SHAPES[zone]) {
        expect(ids.has(shapeId)).toBe(true);
      }
    }
  });

  it("gives every shape non-empty path data", () => {
    for (const s of SHAPES) {
      expect(s.d.length).toBeGreaterThan(0);
      expect(s.d.trim().startsWith("M")).toBe(true);
    }
  });

  it("spreads axle zones across both wheels on that axle", () => {
    expect([...ZONE_SHAPES.AXLE_FRONT].sort()).toEqual(["WHEEL_FL", "WHEEL_FR"]);
    expect([...ZONE_SHAPES.AXLE_REAR].sort()).toEqual(["WHEEL_RL", "WHEEL_RR"]);
    expect(ZONE_SHAPES.CORNERS_ALL).toHaveLength(4);
  });

  it("gives a shape the worst status across every zone touching it", () => {
    // A front wheel belongs to WHEEL_FL, AXLE_FRONT and CORNERS_ALL.
    const out = shapeStatuses({ WHEEL_FL: "GOOD", AXLE_FRONT: "CRITICAL" });
    expect(out.WHEEL_FL).toBe("CRITICAL");
    expect(out.WHEEL_FR).toBe("CRITICAL"); // also on the front axle
    expect(out.WHEEL_RL).toBeUndefined();
  });

  it("reports every zone covering a shape", () => {
    expect(zonesForShape("WHEEL_FL").sort()).toEqual(["AXLE_FRONT", "CORNERS_ALL", "WHEEL_FL"]);
  });

  it("returns an empty map when nothing is scored", () => {
    expect(shapeStatuses({})).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- diagramGeometry`
Expected: FAIL — cannot resolve `./diagramGeometry`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/member/src/features/health-score/diagramGeometry.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- diagramGeometry`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/health-score/diagramGeometry.ts apps/member/src/features/health-score/diagramGeometry.test.ts
git commit -m "feat(member): add vehicle diagram geometry and zone-shape mapping"
```

---

### Task 8: The VehicleDiagram component

**Files:**
- Create: `apps/member/src/features/health-score/VehicleDiagram.tsx`
- Test: `apps/member/src/features/health-score/VehicleDiagram.test.tsx`

**Interfaces:**
- Consumes: `SHAPES`, `shapeStatuses`, `DIAGRAM_VIEWBOX`, `ShapeId` (Task 7); `statusColor` (Task 5)
- Produces: `<VehicleDiagram results={...} onShapePress={(id: ShapeId) => void} />`

Presentational only — it fetches nothing. `testID` per shape is `zone-<ShapeId>`.

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/health-score/VehicleDiagram.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { VehicleDiagram } from "./VehicleDiagram";
import { statusColor } from "./statusColor";

const results = [
  { diagramZone: "WHEEL_FL", status: "CRITICAL" },
  { diagramZone: "ENGINE_BAY", status: "MONITOR" },
] as any;

describe("VehicleDiagram", () => {
  it("renders every shape", () => {
    render(<VehicleDiagram results={results} />);
    expect(screen.getByTestId("zone-WHEEL_FL")).toBeTruthy();
    expect(screen.getByTestId("zone-CABIN")).toBeTruthy();
  });

  it("fills a shape with its worst status colour", () => {
    render(<VehicleDiagram results={results} />);
    expect(screen.getByTestId("zone-WHEEL_FL").props.fill).toBe(statusColor("CRITICAL"));
    expect(screen.getByTestId("zone-ENGINE_BAY").props.fill).toBe(statusColor("MONITOR"));
  });

  it("leaves unscored shapes neutral", () => {
    render(<VehicleDiagram results={results} />);
    expect(screen.getByTestId("zone-WHEEL_RR").props.fill).toBe(statusColor("GOOD"));
  });

  it("reports the tapped shape", () => {
    const onShapePress = jest.fn();
    render(<VehicleDiagram results={results} onShapePress={onShapePress} />);
    fireEvent.press(screen.getByTestId("zone-WHEEL_FL"));
    expect(onShapePress).toHaveBeenCalledWith("WHEEL_FL");
  });

  it("renders with no results at all", () => {
    expect(() => render(<VehicleDiagram results={[]} />)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- VehicleDiagram`
Expected: FAIL — cannot resolve `./VehicleDiagram`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/member/src/features/health-score/VehicleDiagram.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- VehicleDiagram`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/health-score/VehicleDiagram.tsx apps/member/src/features/health-score/VehicleDiagram.test.tsx
git commit -m "feat(member): add tappable colour-coded VehicleDiagram (M-39)"
```

---

### Task 9: The zone detail sheet (M-40)

**Files:**
- Create: `apps/member/src/features/health-score/DiagramZoneSheet.tsx`
- Test: `apps/member/src/features/health-score/DiagramZoneSheet.test.tsx`

**Interfaces:**
- Consumes: `zonesForShape`, `SHAPES`, `ShapeId` (Task 7); `statusColor` (Task 5); existing `BottomSheet` from `../../components/BottomSheet`
- Produces: `<DiagramZoneSheet shapeId={ShapeId | null} results={...} onClose={...} onSelectPoint={(r) => void} />`

This is the disambiguation step the grouped-zone design depends on: tapping the engine bay must reveal that Engine, Battery and Fluids all live there.

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/health-score/DiagramZoneSheet.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DiagramZoneSheet } from "./DiagramZoneSheet";

const results = [
  { pointCode: "ENGINE_IDLE", label: "Engine idle quality", diagramZone: "ENGINE_BAY", status: "MONITOR", categoryCode: "ENGINE" },
  { pointCode: "BATTERY_VOLTAGE", label: "Battery voltage", diagramZone: "ENGINE_BAY", status: "GOOD", categoryCode: "BATTERY" },
  { pointCode: "TREAD_FL", label: "Front-left tyre tread", diagramZone: "WHEEL_FL", status: "CRITICAL", categoryCode: "TYRES" },
] as any;

describe("DiagramZoneSheet", () => {
  it("lists only the points in the tapped shape", () => {
    render(<DiagramZoneSheet shapeId="ENGINE_BAY" results={results} onClose={jest.fn()} />);
    expect(screen.getByText("Engine idle quality")).toBeTruthy();
    expect(screen.getByText("Battery voltage")).toBeTruthy();
    expect(screen.queryByText("Front-left tyre tread")).toBeNull();
  });

  it("includes points reaching a wheel through an axle or corners-all zone", () => {
    const withAxle = [
      ...results,
      { pointCode: "BRAKE_PAD_FRONT", label: "Front brake pads", diagramZone: "AXLE_FRONT", status: "ATTENTION", categoryCode: "BRAKES" },
      { pointCode: "SHOCKS", label: "Shock absorbers", diagramZone: "CORNERS_ALL", status: "GOOD", categoryCode: "SUSP" },
    ] as any;
    render(<DiagramZoneSheet shapeId="WHEEL_FL" results={withAxle} onClose={jest.fn()} />);
    expect(screen.getByText("Front-left tyre tread")).toBeTruthy();
    expect(screen.getByText("Front brake pads")).toBeTruthy();
    expect(screen.getByText("Shock absorbers")).toBeTruthy();
  });

  it("renders nothing when no shape is selected", () => {
    const { toJSON } = render(<DiagramZoneSheet shapeId={null} results={results} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it("reports the selected point", () => {
    const onSelectPoint = jest.fn();
    render(<DiagramZoneSheet shapeId="ENGINE_BAY" results={results} onClose={jest.fn()} onSelectPoint={onSelectPoint} />);
    fireEvent.press(screen.getByTestId("zone-point-ENGINE_IDLE"));
    expect(onSelectPoint).toHaveBeenCalledWith(expect.objectContaining({ pointCode: "ENGINE_IDLE" }));
  });

  it("explains an empty zone rather than showing a blank sheet", () => {
    render(<DiagramZoneSheet shapeId="UNDERBODY" results={results} onClose={jest.fn()} />);
    expect(screen.getByText(/nothing was recorded/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- DiagramZoneSheet`
Expected: FAIL — cannot resolve `./DiagramZoneSheet`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/member/src/features/health-score/DiagramZoneSheet.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- DiagramZoneSheet`
Expected: PASS (5 tests)

If `BottomSheet` requires props beyond `title`/`onClose`, check its signature at `apps/member/src/components/BottomSheet.tsx` and match it — do not change `BottomSheet` itself.

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/health-score/DiagramZoneSheet.tsx apps/member/src/features/health-score/DiagramZoneSheet.test.tsx
git commit -m "feat(member): add diagram zone detail sheet (M-40)"
```

---

### Task 10: Wire the diagram into the health score screen

**Files:**
- Modify: `apps/member/src/features/health-score/HealthScoreScreen.tsx`
- Test: `apps/member/src/features/health-score/HealthScoreScreen.test.tsx`

**Interfaces:**
- Consumes: `VehicleDiagram` (Task 8), `DiagramZoneSheet` (Task 9), existing `ExplainSheet`
- Produces: nothing downstream — this is the final integration

The screen gains an optional `results` prop. When it is absent or empty the toggle does not render at all, so a vehicle with no inspection never shows an empty diagram.

- [ ] **Step 1: Write the failing test**

Append to `apps/member/src/features/health-score/HealthScoreScreen.test.tsx`:

```tsx
  it("offers a diagram toggle when inspection results are available", () => {
    render(<HealthScoreScreen score={score} results={results} />);
    expect(screen.getByTestId("view-toggle-diagram")).toBeTruthy();
  });

  it("hides the toggle when there are no results yet", () => {
    render(<HealthScoreScreen score={score} results={[]} />);
    expect(screen.queryByTestId("view-toggle-diagram")).toBeNull();
  });

  it("shows the diagram after switching to it", () => {
    render(<HealthScoreScreen score={score} results={results} />);
    fireEvent.press(screen.getByTestId("view-toggle-diagram"));
    expect(screen.getByTestId("zone-ENGINE_BAY")).toBeTruthy();
  });
```

Add at the top of the file, beside the existing `score` fixture:

```tsx
const results = [
  { pointCode: "ENGINE_IDLE", label: "Engine idle quality", diagramZone: "ENGINE_BAY", status: "MONITOR", categoryCode: "ENGINE" },
] as any;
```

Ensure `fireEvent` is imported from `@testing-library/react-native` in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- HealthScoreScreen`
Expected: FAIL — no `view-toggle-diagram` testID.

- [ ] **Step 3: Write minimal implementation**

In `apps/member/src/features/health-score/HealthScoreScreen.tsx`:

Add imports:

```tsx
import { useState } from "react";
import { Pressable } from "react-native";
import { VehicleDiagram } from "./VehicleDiagram";
import { DiagramZoneSheet } from "./DiagramZoneSheet";
import { ExplainSheet, type ExplainTarget } from "./ExplainSheet";
import type { ShapeId } from "./diagramGeometry";
import type { InspectionResultDetail } from "./healthScoreApi";
```

Extend the props:

```tsx
  score: HealthScore;
  results?: InspectionResultDetail[];
```

Add state inside the component, above the `return`:

```tsx
  const [view, setView] = useState<"list" | "diagram">("list");
  const [openShape, setOpenShape] = useState<ShapeId | null>(null);
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  const hasResults = (results?.length ?? 0) > 0;
```

Insert the toggle immediately after the closing tag of the first `<Card>` (the gauge card):

```tsx
      {hasResults && (
        <View style={{ flexDirection: "row", gap: t.spacing.sm }}>
          {(["list", "diagram"] as const).map((v) => (
            <Pressable
              key={v}
              testID={`view-toggle-${v}`}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={{
                flex: 1,
                minHeight: t.minTarget,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: t.radii.md,
                backgroundColor: view === v ? t.colors.primary : t.colors.surface,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            >
              <Text style={{ ...t.text("label"), color: view === v ? "#FFFFFF" : t.colors.ink }}>
                {v === "list" ? "List" : "Diagram"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {hasResults && view === "diagram" && (
        <Card pad="lg">
          <VehicleDiagram results={results!} onShapePress={setOpenShape} />
        </Card>
      )}
```

Then wrap the existing "Why this score?" card and detractor content so it only renders in list view, by changing its condition from

```tsx
      {(score.overrideApplied !== "NONE" || score.topDetractors.length > 0) && (
```

to

```tsx
      {view === "list" && (score.overrideApplied !== "NONE" || score.topDetractors.length > 0) && (
```

Finally, add the two sheets just before the closing `</ScrollView>`:

```tsx
      <DiagramZoneSheet
        shapeId={openShape}
        results={results ?? []}
        onClose={() => setOpenShape(null)}
        onSelectPoint={(r) => {
          setOpenShape(null);
          setExplain({
            point: {
              code: r.pointCode,
              label: r.label,
              templates: r.templates,
              recommendation: r.recommendation,
              thresholds: r.thresholds,
              unit: r.unit,
            } as ExplainTarget["point"],
            status: r.status ?? "NOT_APPLICABLE",
            measuredValue: r.measuredValue ?? undefined,
            photoUrl: r.photoUrls?.[0],
          });
        }}
      />
      <ExplainSheet target={explain} onClose={() => setExplain(null)} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test -- HealthScoreScreen`
Expected: PASS — the three new tests plus every pre-existing one.

- [ ] **Step 5: Run the full member and API suites**

Run: `pnpm --filter member test && pnpm --filter api test -- src/modules/inspections`
Expected: PASS. Nothing outside the health-score feature should have moved.

- [ ] **Step 6: Typecheck the workspace**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/member/src/features/health-score/HealthScoreScreen.tsx apps/member/src/features/health-score/HealthScoreScreen.test.tsx
git commit -m "feat(member): add diagram/list toggle to the health score screen"
```

---

## Verification checklist

After Task 10, confirm against the spec:

- [ ] A vehicle with no inspection shows no toggle and no diagram (spec §7)
- [ ] `BRAKE_DISC_CONDITION`, `TYRE_PRESSURE_DEV`, `WHEEL_CONDITION`, `HORN` appear in list view but never colour the diagram (spec §4)
- [ ] Tapping the engine bay lists Engine, Battery **and** Fluids points (spec §3)
- [ ] Tapping a front wheel lists tread, front brake pads **and** suspension (spec §4)
- [ ] A stale score still shows the existing stale gauge treatment; no second staleness concept was introduced on the diagram (spec §7)
- [ ] An inspection whose points all have `diagramZone = null` (a pre-migration checklist version) renders a neutral car without error (spec §7, §10)
- [ ] Scores are byte-identical before and after: `pnpm --filter @autocare/scoring test` golden suite passes (NFR-055)
- [ ] No colour literal was introduced anywhere in the new files — grep for `#` in the five new client files and expect only `#FFFFFF` in the toggle label
