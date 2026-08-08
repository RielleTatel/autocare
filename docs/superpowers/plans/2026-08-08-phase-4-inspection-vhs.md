# Phase 4 — Inspection & Vehicle Health Score Implementation Plan ⭐

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mechanic captures a structured inspection offline on the field app; submission syncs idempotently, computes an immutable VHS with category breakdown and top detractors; the member sees it on iOS; a shareable server-rendered certificate page previews correctly from a Facebook/Viber link.

**Architecture:** A pure `packages/scoring` engine (zero I/O, golden-tested) consumed by the API's `InspectionsModule`. Field app persists to SQLite and drains an ordered outbox to `POST /sync/batch`, which dedupes by client UUID. Scores, results, and inspections are append-only. Certificates are unguessable-token public SSR pages in Next.js.

**Tech Stack:** TypeScript, Vitest (scoring), NestJS + Prisma + Jest (api), expo-sqlite + expo-image-manipulator + expo-network (field), Next.js SSR + `ImageResponse` OG images (web), Socket.IO (`score.ready`).

**Covers:** M5 (FR-053→FR-065), BR-05, BR-06, NFR-004/006/007/014/039/054/055; screens F-03→F-09, M-13→M-16, P-01→P-03, A-04/A-05.

**Prerequisites:** Phases 0–3 merged. Schedule the mechanic review of seed thresholds now (risk R-08) — it gates launch, not development.

## Global Constraints

- `packages/scoring` is pure: no I/O, no clock reads, no randomness; age enters as `daysSinceInspection`. 100% branch coverage (NFR-039).
- **Rounding rule (fixes the spec's worked example exactly):** category sub-scores round to 1 dp; the rollup consumes the rounded sub-scores; `rawScore` rounds to 3 dp; final `score` rounds to nearest integer, clamped [0,100]. This reproduces §11.4: brakes 75.8 → raw 84.494 → capped 69.
- `inspections`, `inspection_results`, `health_scores`, `category_scores` are append-only (NFR-054): corrections create new records via `supersedes_id`; no UPDATE path in any service.
- Published checklist versions are immutable (FR-101); every score stores `checklistVersionId` + `weightVersion`; recomputation must reproduce stored scores bit-for-bit (NFR-055).
- Offline: client UUID on every offline-created record; ordered drain; **client wins** for inspection content; server dedupes via `sync_outbox_receipts`.
- Photos client-compressed ≤500 KB (NFR-006); JSON record syncs before its photos attach.
- Certificate `publicToken` ≥128-bit crypto randomness, revocable; public page renders zero member contact data (FR-065, NFR-022).
- Score computed and persisted ≤2 s after submission (NFR-004). Score staleness at 90 days is display state, never arithmetic (BR-05).
- Field UI: ≥56 dp targets, band colors from `@autocare/design-tokens` `vhsBands` only.

---

### Task 1: `packages/scoring` — types and engine core

**Files:**
- Create: `packages/scoring/package.json`, `tsconfig.json`, `vitest.config.ts` (coverage `branches: 100`)
- Create: `packages/scoring/src/types.ts`, `src/engine.ts`, `src/index.ts`
- Test: `packages/scoring/src/engine.test.ts`

**Interfaces:**
- Consumes: `vhsBands` band keys from `@autocare/design-tokens` (type-level only — the engine re-declares the union to stay dependency-free; a type test asserts they match).
- Produces: `computeVHS(inspection: InspectionInput, config: ChecklistConfig): ScoreResult` — consumed by Task 7's service and Task 3's admin preview. `deriveStatus(value: number, t: Thresholds): PointStatus` — also used client-side for the live preview in Task 6.

- [ ] **Step 1: Write `types.ts`** (this is the contract; no test yet)

```typescript
export type PointStatus = "GOOD" | "MONITOR" | "ATTENTION" | "CRITICAL" | "NOT_APPLICABLE";
export type Band = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type Override = "NONE" | "SAFETY_CRITICAL" | "SAFETY_ATTENTION";

export interface Thresholds {
  direction: "HIGHER_BETTER" | "LOWER_BETTER";
  good: number;      // HIGHER_BETTER: value >= good → GOOD; LOWER_BETTER: value < good → GOOD
  monitor: number;   // next boundary, same orientation
  attention: number; // beyond attention (or >= for LOWER_BETTER) → CRITICAL
}

export interface ConfigPoint {
  code: string; label: string; weightInCategory: number;
  isSafetyCritical: boolean;
  inputType: "STATUS" | "MEASURED";
  unit?: string;
  thresholds?: Thresholds;           // required when inputType === "MEASURED"
  recommendation: string;            // shown when the point detracts
}
export interface ConfigCategory { code: string; label: string; weight: number; points: ConfigPoint[] }
export interface ChecklistConfig { checklistVersion: string; weightVersion: string; categories: ConfigCategory[] }

export interface ResultInput { pointCode: string; status?: PointStatus; measuredValue?: number }
export interface InspectionInput { results: ResultInput[]; daysSinceInspection: number }

export interface ScoreResult {
  score: number; rawScore: number; band: Band; confidence: Confidence;
  categoryScores: Array<{ categoryCode: string; label: string; weight: number; score: number; applicablePoints: number }>;
  overrideApplied: Override;
  topDetractors: Array<{ pointCode: string; label: string; status: PointStatus; scoreImpact: number; recommendation: string }>;
  checklistVersion: string; weightVersion: string;
}
```

- [ ] **Step 2: Write the failing worked-example test** — the spec's §11.4 example is the primary oracle:

```typescript
import { describe, expect, it } from "vitest";
import { computeVHS, deriveStatus } from "./engine";
import type { ChecklistConfig } from "./types";

/** Categories tuned so sub-scores match §11.4 exactly:
 *  ENGINE 92 (w68 GOOD + w32 MONITOR), BRAKES 75.8 (the doc's 5 points),
 *  TYRES 70 (w50 GOOD + w50 ATTENTION), BATTERY 100, FLUIDS 85 (w75 GOOD + w25 ATTENTION),
 *  SUSPENSION 90 (w60 GOOD + w40 MONITOR), LIGHTS 75 (single MONITOR), BODY 95 (w80 GOOD + w20 MONITOR). */
export const workedExampleConfig: ChecklistConfig = {
  checklistVersion: "test-v1", weightVersion: "test-w1",
  categories: [
    { code: "ENGINE", label: "Engine & Drivetrain", weight: 20, points: [
      p("ENG_A", 68), p("ENG_B", 32)] },
    { code: "BRAKES", label: "Brakes", weight: 18, points: [
      m("BRAKE_PAD_FRONT", 30, true, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }),
      m("BRAKE_PAD_REAR", 25, true, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 }),
      m("BRAKE_FLUID", 20, true, { direction: "LOWER_BETTER", good: 2, monitor: 3, attention: 4 }),
      p("BRAKE_DISC", 15, true), p("PARKING_BRAKE", 10, true)] },
    { code: "TYRES", label: "Tyres & Wheels", weight: 15, points: [p("TY_A", 50), p("TY_B", 50)] },
    { code: "BATTERY", label: "Battery & Electrical", weight: 12, points: [p("BAT_A", 100)] },
    { code: "FLUIDS", label: "Fluids", weight: 12, points: [p("FL_A", 75), p("FL_B", 25)] },
    { code: "SUSP", label: "Suspension & Steering", weight: 10, points: [p("SU_A", 60), p("SU_B", 40)] },
    { code: "LIGHTS", label: "Lights & Visibility", weight: 8, points: [p("LI_A", 100)] },
    { code: "BODY", label: "Body & Undercarriage", weight: 5, points: [p("BO_A", 80), p("BO_B", 20)] },
  ],
};
function p(code: string, w: number, sc = false) {
  return { code, label: code, weightInCategory: w, isSafetyCritical: sc, inputType: "STATUS" as const, recommendation: `Fix ${code}` };
}
function m(code: string, w: number, sc: boolean, thresholds: any) {
  return { code, label: code, weightInCategory: w, isSafetyCritical: sc, inputType: "MEASURED" as const, thresholds, recommendation: `Fix ${code}` };
}

const workedResults = [
  { pointCode: "ENG_A", status: "GOOD" }, { pointCode: "ENG_B", status: "MONITOR" },
  { pointCode: "BRAKE_PAD_FRONT", measuredValue: 3.0 },   // → ATTENTION (safety-critical)
  { pointCode: "BRAKE_PAD_REAR", measuredValue: 6.0 },    // → MONITOR
  { pointCode: "BRAKE_FLUID", measuredValue: 1.4 },       // → GOOD
  { pointCode: "BRAKE_DISC", status: "GOOD" }, { pointCode: "PARKING_BRAKE", status: "GOOD" },
  { pointCode: "TY_A", status: "GOOD" }, { pointCode: "TY_B", status: "ATTENTION" },
  { pointCode: "BAT_A", status: "GOOD" },
  { pointCode: "FL_A", status: "GOOD" }, { pointCode: "FL_B", status: "ATTENTION" },
  { pointCode: "SU_A", status: "GOOD" }, { pointCode: "SU_B", status: "MONITOR" },
  { pointCode: "LI_A", status: "MONITOR" },
  { pointCode: "BO_A", status: "GOOD" }, { pointCode: "BO_B", status: "MONITOR" },
] as const;

describe("worked example (VHS doc §11.4)", () => {
  const result = () => computeVHS({ results: [...workedResults], daysSinceInspection: 0 }, workedExampleConfig);
  it("derives measured statuses from thresholds", () => {
    expect(deriveStatus(3.0, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 })).toBe("ATTENTION");
    expect(deriveStatus(6.0, { direction: "HIGHER_BETTER", good: 7, monitor: 4, attention: 2 })).toBe("MONITOR");
    expect(deriveStatus(1.4, { direction: "LOWER_BETTER", good: 2, monitor: 3, attention: 4 })).toBe("GOOD");
  });
  it("computes brakes sub-score 75.8", () => {
    expect(result().categoryScores.find(c => c.categoryCode === "BRAKES")!.score).toBe(75.8);
  });
  it("computes rawScore 84.494", () => { expect(result().rawScore).toBe(84.494); });
  it("caps at 69 via SAFETY_ATTENTION override", () => {
    expect(result().score).toBe(69);
    expect(result().overrideApplied).toBe("SAFETY_ATTENTION");
    expect(result().band).toBe("FAIR");
  });
  it("ranks front brake pads as top detractor", () => {
    expect(result().topDetractors[0].pointCode).toBe("BRAKE_PAD_FRONT");
    expect(result().topDetractors).toHaveLength(3);
  });
  it("reports HIGH confidence for a complete, fresh inspection", () => {
    expect(result().confidence).toBe("HIGH");
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm --filter @autocare/scoring test` → FAIL (engine missing).

- [ ] **Step 4: Implement `engine.ts`**

```typescript
import type { Band, ChecklistConfig, Confidence, InspectionInput, Override, PointStatus, ScoreResult, Thresholds } from "./types";

const FACTORS: Record<Exclude<PointStatus, "NOT_APPLICABLE">, number> = {
  GOOD: 1.0, MONITOR: 0.75, ATTENTION: 0.4, CRITICAL: 0.0,
};
const round = (n: number, dp: number) => { const f = 10 ** dp; return Math.round(n * f) / f; };

export function deriveStatus(value: number, t: Thresholds): PointStatus {
  if (t.direction === "HIGHER_BETTER") {
    if (value >= t.good) return "GOOD";
    if (value >= t.monitor) return "MONITOR";
    if (value >= t.attention) return "ATTENTION";
    return "CRITICAL";
  }
  if (value < t.good) return "GOOD";
  if (value < t.monitor) return "MONITOR";
  if (value < t.attention) return "ATTENTION";
  return "CRITICAL";
}

export function bandForScore(score: number): Band {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}

export function computeVHS(inspection: InspectionInput, config: ChecklistConfig): ScoreResult {
  const byCode = new Map(inspection.results.map(r => [r.pointCode, r]));
  let totalPoints = 0, completedPoints = 0;
  let safetyWorst: "NONE" | "ATTENTION" | "CRITICAL" = "NONE";
  const categoryScores: ScoreResult["categoryScores"] = [];
  const detractors: ScoreResult["topDetractors"] = [];

  // Resolve every point's status once
  const resolved = config.categories.map(cat => ({
    cat,
    points: cat.points.map(pt => {
      totalPoints += 1;
      const r = byCode.get(pt.code);
      let status: PointStatus | undefined;
      if (pt.inputType === "MEASURED" && r?.measuredValue !== undefined && pt.thresholds) {
        status = deriveStatus(r.measuredValue, pt.thresholds);
      } else if (r?.status) {
        status = r.status;
      }
      if (status !== undefined) completedPoints += 1;
      if (pt.isSafetyCritical && status === "CRITICAL") safetyWorst = "CRITICAL";
      else if (pt.isSafetyCritical && status === "ATTENTION" && safetyWorst !== "CRITICAL") safetyWorst = "ATTENTION";
      return { pt, status };
    }),
  }));

  // Category sub-scores over applicable, answered points
  let weightedSum = 0, weightTotal = 0;
  for (const { cat, points } of resolved) {
    const applicable = points.filter(x => x.status !== undefined && x.status !== "NOT_APPLICABLE");
    if (applicable.length === 0) { categoryScores.push({ categoryCode: cat.code, label: cat.label, weight: cat.weight, score: 0, applicablePoints: 0 }); continue; }
    const wSum = applicable.reduce((s, x) => s + x.pt.weightInCategory, 0);
    const wf = applicable.reduce((s, x) => s + x.pt.weightInCategory * FACTORS[x.status as keyof typeof FACTORS], 0);
    const sub = round(100 * (wf / wSum), 1);
    categoryScores.push({ categoryCode: cat.code, label: cat.label, weight: cat.weight, score: sub, applicablePoints: applicable.length });
    weightedSum += cat.weight * sub;
    weightTotal += cat.weight;
    for (const x of applicable) {
      const factor = FACTORS[x.status as keyof typeof FACTORS];
      if (factor < 1) {
        const impact = round((cat.weight * x.pt.weightInCategory * (1 - factor)) / wSum, 2);
        detractors.push({ pointCode: x.pt.code, label: x.pt.label, status: x.status!, scoreImpact: impact, recommendation: x.pt.recommendation });
      }
    }
  }

  const rawScore = round(weightTotal === 0 ? 0 : weightedSum / weightTotal, 3);
  let overrideApplied: Override = "NONE";
  let capped = rawScore;
  if (safetyWorst === "CRITICAL") { capped = Math.min(rawScore, 49); overrideApplied = "SAFETY_CRITICAL"; }
  else if (safetyWorst === "ATTENTION") { capped = Math.min(rawScore, 69); overrideApplied = "SAFETY_ATTENTION"; }
  const score = Math.min(100, Math.max(0, Math.round(capped)));

  const completion = totalPoints === 0 ? 0 : completedPoints / totalPoints;
  const days = inspection.daysSinceInspection;
  let confidence: Confidence = "LOW";
  if (completion >= 0.95 && days <= 30) confidence = "HIGH";
  else if (completion >= 0.85 && days <= 90) confidence = "MEDIUM";

  detractors.sort((a, b) => b.scoreImpact - a.scoreImpact);
  return {
    score, rawScore, band: bandForScore(score), confidence, categoryScores,
    overrideApplied, topDetractors: detractors.slice(0, 3),
    checklistVersion: config.checklistVersion, weightVersion: config.weightVersion,
  };
}
```

`index.ts` re-exports engine + types. `package.json` mirrors `@autocare/design-tokens` (name `@autocare/scoring`, zero runtime deps).

- [ ] **Step 5: Run tests to verify pass** — all worked-example assertions green.
- [ ] **Step 6: Commit** — `git commit -m "feat(scoring): pure VHS engine reproducing spec worked example"`

---

### Task 2: `packages/scoring` — golden fixture suite + edge coverage

**Files:**
- Create: `packages/scoring/fixtures/*.json` (30+ files: `{ name, config?, results, daysSinceInspection, expected: { score, rawScore, band, confidence, overrideApplied } }` — `config` omitted means the seed v1.0 config from Task 3's shared fixture)
- Create: `packages/scoring/src/golden.test.ts`, `src/edge.test.ts`

**Interfaces:** Consumes Task 1's engine; produces the regression net every future engine change must pass.

- [ ] **Step 1: Write the golden runner (fails — no fixtures yet)**

```typescript
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeVHS } from "./engine";
import { seedConfig } from "./seed-config";   // authored in Task 3 Step 1, imported here

const dir = join(__dirname, "..", "fixtures");
describe("golden fixtures", () => {
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  it("has at least 30 fixtures (NFR-039)", () => expect(files.length).toBeGreaterThanOrEqual(30));
  for (const f of files) {
    it(f, () => {
      const fx = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const out = computeVHS({ results: fx.results, daysSinceInspection: fx.daysSinceInspection }, fx.config ?? seedConfig);
      expect(out).toMatchObject(fx.expected);
    });
  }
});
```

- [ ] **Step 2: Author fixtures 1–30.** Required coverage matrix — one fixture each, hand-compute `expected` (show arithmetic in a `notes` field inside each JSON):
  1. Worked example (§11.4) — raw 84.494, capped 69, FAIR.
  2. All GOOD → 100, EXCELLENT, no override.
  3. All CRITICAL → 0, CRITICAL band, SAFETY_CRITICAL override.
  4. Safety-critical CRITICAL with otherwise-perfect car → cap 49 (raw ≈ high 90s).
  5. Safety-critical ATTENTION only → cap 69.
  6. Non-safety CRITICAL (e.g. horn) → no override, weighted drop only.
  7. N/A-heavy vehicle (MT car: ATF N/A; EPS: PS fluid N/A) — N/A excluded from both sums.
  8. Whole category N/A → category excluded from rollup denominator.
  9–15. Threshold edges, one per measured type: tread 5.0→GOOD / 4.9→MONITOR / 3.0→MONITOR / 2.9→ATTENTION / 1.6→ATTENTION / 1.5→CRITICAL; pad 7.0/6.9/4.0/3.9/2.0/1.9; voltage 12.6/12.59/12.4/12.39/12.0/11.99; oil % / coolant % / moisture % / pressure-deviation boundaries.
  16. Rounding: sub-score x.x5 cases (banker's vs half-up — assert half-up).
  17. Score exactly 90 → EXCELLENT; 89.5 → rounds 90 EXCELLENT; 89.4 → 89 GOOD (band boundary behavior pinned).
  18. Confidence HIGH boundary: 95% complete, day 30.
  19. Confidence MEDIUM: 94% complete fresh; and 100% complete day 31.
  20. Confidence LOW: 84% complete; and day 91 (STALE).
  21. Incomplete inspection (missing results) — unanswered points excluded, completion% reflects it.
  22. Detractor ordering: three known impacts in strict descending order.
  23. Detractor tie → stable order (by config order).
  24. Single-point category.
  25. Measured point sent with status instead of value (offline fallback: status honored when value absent).
  26. Measured value + thresholds → status field in payload ignored (derived wins).
  27. Zero-weight point present → contributes nothing, no NaN.
  28. All MONITOR → 75 exactly, GOOD band.
  29. Mixed real-world mid-range car (~82, no override) — sanity fixture from the mechanic review session (R-08).
  30. Old jeepney profile (~45, NEEDS_ATTENTION, multiple safety ATTENTION → cap 69? no — cap only if safety-critical; verify worst-of logic with both ATTENTION and CRITICAL safety points → 49 wins).
- [ ] **Step 3: Edge tests in `edge.test.ts`:** empty results → score 0, LOW confidence; unknown `pointCode` in results → ignored; branch-coverage stragglers until vitest coverage reports 100% branches on `engine.ts`.
- [ ] **Step 4: Reproducibility test:** run `computeVHS` twice on every fixture, `expect(a).toEqual(b)`; and a serialized-snapshot test (`expect(JSON.stringify(out)).toMatchSnapshot()`) so accidental output-shape drift fails CI (NFR-055).
- [ ] **Step 5: Run full suite + coverage** — `pnpm --filter @autocare/scoring test -- --coverage` → 100% branches.
- [ ] **Step 6: Commit** — `git commit -m "test(scoring): 30+ golden fixtures, edge and reproducibility suites"`

---

### Task 3: Seed checklist v1.0 + Prisma schema for inspection domain

**Files:**
- Create: `packages/scoring/src/seed-config.ts` (the launch checklist as a `ChecklistConfig` — single authoring point, used by golden tests AND the DB seed)
- Modify: `apps/api/prisma/schema.prisma` (+migration `inspection-vhs`)
- Create: `apps/api/prisma/seed-checklist.ts`
- Test: `apps/api/test/checklist-seed.e2e-spec.ts`

**Interfaces:**
- Produces: DB rows for checklist v1.0 (8 categories, 43 points); Prisma models `ChecklistVersion`, `ChecklistCategory`, `ChecklistPoint`, `Inspection`, `InspectionResult`, `HealthScore`, `CategoryScore`, `Certificate`, `Recommendation`, `SyncOutboxReceipt` exactly as the Data Model §8.3 tables; `seedConfig` export used by Task 2.

- [ ] **Step 1: Author `seed-config.ts`.** Categories with spec weights — ENGINE 20, BRAKES 18, TYRES 15, BATTERY 12, FLUIDS 12, SUSP 10, LIGHTS 8, BODY 5. Points (43; `(M)`=measured with §11.3 Step 2 thresholds, `SC`=safety-critical; in-category weights shown, each category sums to 100):
  - ENGINE: ENGINE_IDLE 20, ENGINE_NOISE 15, DRIVE_BELTS 15, ENGINE_LEAKS 15, TRANSMISSION_SHIFT 15, ENGINE_MOUNTS 10, CLUTCH_OPERATION 10 (N/A for AT)
  - BRAKES: BRAKE_PAD_FRONT (M mm) 30 SC, BRAKE_PAD_REAR (M mm) 25 SC, BRAKE_FLUID_MOISTURE (M %) 20 SC, BRAKE_DISC_CONDITION 15 SC, PARKING_BRAKE 10 SC
  - TYRES: TREAD_FL/FR/RL/RR (M mm) 20 each SC, TYRE_PRESSURE_DEV (M %) 10 SC, WHEEL_CONDITION 10
  - BATTERY: BATTERY_VOLTAGE (M V) 40, CHARGING_OUTPUT 25, TERMINALS 20, WIRING_VISIBLE 15
  - FLUIDS: ENGINE_OIL_LEVEL (M %) 30, COOLANT_LEVEL (M %) 25, BRAKE_FLUID_LEVEL 15, ATF_CONDITION 15 (N/A MT), PS_FLUID 10 (N/A EPS), WASHER_FLUID 5
  - SUSP: SHOCKS 30, BUSHINGS 20, BALL_JOINTS 20, STEERING_LINKAGE 20 SC, ALIGNMENT_PULL 10
  - LIGHTS: HEADLIGHTS 25 SC, BRAKE_LIGHTS 25 SC, TURN_SIGNALS 20 SC, WIPERS 15 SC, WINDSCREEN 10 SC, HORN 5
  - BODY: RUST_UNDERCARRIAGE 40, BODY_PANELS 30, DOORS_LOCKS 15, INTERIOR 15
  Each point carries EN + FIL labels and a plain-language `recommendation` (e.g. BRAKE_PAD_FRONT: "Replace front brake pads soon — they are below the safe minimum."). Thresholds verbatim from VHS §11.3 Step 2 (tread: HIGHER_BETTER 5.0/3.0/1.6; pads 7.0/4.0/2.0; voltage 12.6/12.4/12.0; oil & coolant level HIGHER_BETTER 80/60/40; moisture LOWER_BETTER 2.0/3.0/4.0; pressure deviation LOWER_BETTER 6/13/26).
- [ ] **Step 2: Prisma models + migration.** Models per Data Model §8.3 (fields listed in this plan's draft header retained): weights-sum-100 enforced by a deferred DB trigger or a seed-time assertion + service-level validation (choose service-level + CI seed test; document why). `Inspection.clientUuid` unique. `HealthScore.inspectionId` unique. Add `supersedesId` self-relations on `Inspection`. Run `prisma migrate dev --name inspection-vhs`.
- [ ] **Step 3: Seed script** maps `seedConfig` → rows (version label `v1.0`, weightVersion `w1.0`, `isActive: true`). Idempotent (upsert by version label).
- [ ] **Step 4: e2e test:** seed, then `GET /checklists/active` returns 8 categories / 43 points; category weights sum 100; every measured point has thresholds. Verify a fixture from Task 2 scored against DB-loaded config equals the same fixture scored against `seedConfig` (config round-trip fidelity — the DB representation must not lose precision).
- [ ] **Step 5: Commit** — `git commit -m "feat(api): inspection/VHS schema + seeded checklist v1.0"`

---

### Task 4: Checklist admin — versioning API + editor screens (A-04, A-05)

**Files:**
- Create: `apps/api/src/modules/checklists/` (controller, service)
- Create: `apps/web/app/(admin)/checklists/page.tsx`, `[id]/page.tsx` (editor), `[id]/weights/page.tsx`
- Test: `apps/api/test/checklists.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /checklists/active` (staff; ETag = version label, 304 support for field-app caching); `GET /admin/checklists`, `POST /admin/checklists` (clone-from-active draft), `PATCH /admin/checklists/:id` (drafts only), `POST /admin/checklists/:id/publish`.

- [ ] **Step 1: Failing e2e tests:** publish makes the version immutable (`PATCH` after publish → 409); publish deactivates the previous active; only drafts editable; weight change on publish bumps `weightVersion` (`w1.0` → `w1.1`); scores computed under the old version still reference it (assert stored `checklistVersionId` unchanged after a new publish); `GET /checklists/active` honors `If-None-Match` → 304; all admin mutations audit-logged.
- [ ] **Step 2: Implement service** (clone→draft→publish lifecycle; publish validates: category weights sum 100, every measured point has thresholds, every point has EN+FIL labels + recommendation).
- [ ] **Step 3: Web A-04 editor:** category list (drag order), point rows (label EN/FIL, weight, safety-critical toggle, input type, thresholds with direction, photo-on-adverse toggle), draft-only banner, publish dialog with validation report and the warning "Existing scores are unaffected; new inspections will use v{n}."
- [ ] **Step 4: Web A-05 weight editor:** category weight sliders with live sum indicator (blocks ≠100), per-point weights, side-by-side diff vs current active, "preview score" panel — paste/select a past inspection and see its score under draft weights (calls a `POST /admin/checklists/:id/preview-score` endpoint that runs the pure engine, persisting nothing).
- [ ] **Step 5: Run tests, Playwright smoke (create draft → edit → publish), commit** — `git commit -m "feat: versioned checklist admin with immutable publish"`

---

### Task 5: Field app — offline store, outbox, sync client (F-03)

**Files:**
- Create: `apps/field/src/shared/db/schema.ts` (expo-sqlite DDL), `db/inspections.repo.ts`, `db/outbox.repo.ts`
- Create: `apps/field/src/shared/sync/processor.ts`, `sync/photos.ts`, `sync/useSyncStatus.ts`
- Create: `apps/field/src/features/sync/SyncQueueScreen.tsx` (F-03 detail)
- Test: `apps/field/src/shared/sync/processor.test.ts`, `db/outbox.repo.test.ts`

**Interfaces:**
- Consumes: `POST /sync/batch` (Task 6), `POST /uploads/signed-url` (Phase 1).
- Produces: `OutboxRepo.enqueue({ clientUuid, entityType, op, payload })`, `.pendingInOrder()`, `.markSynced(clientUuid)`, `.markRejected(clientUuid, error)`; `SyncProcessor.drain(): Promise<DrainReport>`; `useSyncStatus(): { pendingCount, lastSyncAt, isDraining }` feeding the Phase 0 `SyncBanner`.

- [ ] **Step 1: SQLite DDL** — tables `outbox (client_uuid TEXT PK, entity_type TEXT, op TEXT, payload TEXT, created_at INTEGER, attempts INTEGER DEFAULT 0, state TEXT DEFAULT 'PENDING', last_error TEXT)`, `local_inspections`, `local_results`, `photos_pending (id, owner_client_uuid, local_uri, remote_path, state)`. WAL mode on open (durability, NFR-014).
- [ ] **Step 2: Failing processor unit tests** (fake transport + in-memory repo): drains strictly in `created_at` order; a `DUPLICATE` response marks synced (not error); a `REJECTED` item is parked (state `REJECTED`, surfaced in F-03) and does NOT block later items; network failure leaves order intact and increments `attempts` with exponential backoff (30 s · 2ⁿ, cap 15 min); photos upload only after their owner record's `APPLIED`/`DUPLICATE` receipt; drain is re-entrant-safe (second call while running is a no-op).
- [ ] **Step 3: Implement processor + photo pipeline** (`expo-image-manipulator`: resize longest edge 1600 px, JPEG quality stepping down until ≤500 KB); connectivity listener (`expo-network`) triggers drain; manual "Sync now" button.
- [ ] **Step 4: F-03 screen:** pending list grouped by entity (icon, age, attempts, state), parked-rejection rows expandable to the server error with a "contact advisor" hint, storage-used footer.
- [ ] **Step 5: Run tests; manual airplane-mode drill** (create → kill app → reboot simulator → relaunch → banner shows pending → wifi on → drains). Record the drill in the PR (risk R-02).
- [ ] **Step 6: Commit** — `git commit -m "feat(field): durable offline outbox with ordered idempotent drain"`

---

### Task 6: `/sync/batch` server endpoint

**Files:**
- Create: `apps/api/src/modules/sync/sync.controller.ts`, `sync.service.ts`, `handlers/inspection.handler.ts`
- Create: `packages/contracts/src/sync.ts` (batch envelope schemas)
- Test: `apps/api/test/sync.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /sync/batch` (staff roles): body `{ items: Array<{ clientUuid, entityType: "inspection" | "waste_record" | "trip_status" | "trip_condition" | "payment_cash", op: "create" | "submit", payload }> }` → `{ results: Array<{ clientUuid, status: "APPLIED" | "DUPLICATE" | "REJECTED", error?: { code, message } }> }`. Handler registry keyed by `entityType` — Phase 5/6 register their handlers here without touching sync core. `GET /sync/status` returns the caller's receipt count + last receipt time.

- [ ] **Step 1: Failing e2e tests:** batch of 2 inspections applied → receipts written; identical batch replayed → both `DUPLICATE`, row counts unchanged; batch with one invalid item (missing required results) → that item `REJECTED` with `INSPECTION_INCOMPLETE`, the other `APPLIED`; non-certified mechanic submitting → `NOT_CERTIFIED_TECHNICIAN` (BR-06); items processed in array order (submit-after-create within one batch works); non-staff role → 403.
- [ ] **Step 2: Implement** — per-item transaction (never one giant transaction: partial success is the contract); receipt insert inside the item transaction; `inspection.handler` validates payload with contracts schema, creates `Inspection`+`InspectionResult` rows, `op: "submit"` triggers Task 7's scoring service inline.
- [ ] **Step 3: Run tests, commit** — `git commit -m "feat(api): idempotent per-item sync batch endpoint"`

---

### Task 7: Inspection capture UX (F-04→F-08)

**Files:**
- Create: `apps/field/src/features/inspection/` — `TaskDetailScreen.tsx` (F-04), `CategoryNavScreen.tsx` (F-05), `PointEntryScreen.tsx` (F-06), `PhotoAnnotateScreen.tsx` (F-07), `ReviewSubmitScreen.tsx` (F-08), `useInspectionDraft.ts`
- Test: `PointEntry.test.tsx`, `ReviewSubmit.test.tsx`, `useInspectionDraft.test.ts`

**Interfaces:**
- Consumes: `deriveStatus` from `@autocare/scoring` (live preview identical to server derivation); local repos from Task 5; cached active checklist (ETag refresh when online).
- Produces: a locally-complete inspection queued to the outbox as `create` + `submit` entries.

- [ ] **Step 1: Failing hook tests** (`useInspectionDraft`): starting a draft snapshots the cached checklist version; progress = answered/total per category and overall; `completeness()` lists missing required points and adverse points missing required photos; `submit()` refuses while incomplete, then writes both outbox entries and locks the draft read-only.
- [ ] **Step 2: Failing `PointEntry` component tests:** status chips render all 5 states at ≥56 dp; selecting MEASURED point shows numeric pad + unit and a live derived-status chip that matches `deriveStatus` for entered value; ATTENTION/CRITICAL selection with `requiresPhotoOnAdverse` shows a blocking "add photo" affordance; notes field present.
- [ ] **Step 3: Implement screens.** F-05: 8 category tiles with progress rings, tile accent = worst finding color so far (band tokens); F-06: one point per screen, giant chips, swipe/next navigation, haptic on adverse; F-07: `expo-camera` capture → simple arrow/circle annotation overlay → compressed and linked; F-08: completion %, missing list (tap jumps to point), summary of adverse findings, submit button (disabled until complete) → outbox → lock → land on F-09 pending state ("Score will appear when synced" if offline).
- [ ] **Step 4: RTL suite green; simulator run-through of a full 43-point capture.** Commit — `git commit -m "feat(field): offline inspection capture flow"`

---

### Task 8: Scoring integration, score endpoints, score screens (F-09, M-13→M-15)

**Files:**
- Create: `apps/api/src/modules/inspections/scoring-integration.service.ts`, `inspections.controller.ts`
- Create: `apps/api/src/modules/jobs/processors/mark-stale.processor.ts`
- Create: `apps/member/src/features/health-score/` — `ScoreGauge.tsx`, `HealthScoreScreen.tsx` (M-13), `CategoryBreakdownScreen.tsx` (M-14), `ScoreHistoryScreen.tsx` (M-15)
- Create: `apps/field/src/features/inspection/ScoreResultScreen.tsx` (F-09)
- Test: `apps/api/test/scoring-integration.e2e-spec.ts`, `apps/member/src/features/health-score/ScoreGauge.test.tsx`

**Interfaces:**
- Produces: on submission — one transaction persisting `HealthScore` + `CategoryScore[]` + `Recommendation[]` (from ATTENTION/CRITICAL results; severity mirrors status; `estimatedCostCentavos` null until Phase 5 quoting), then Socket.IO `score.ready { vehicleId, score, band }`; `GET /vehicles/:id/health-score` (API §9.6 response shape verbatim), `GET /vehicles/:id/health-score/history`; `ScoreGauge` RN component reused by F-09 and M-13.

- [ ] **Step 1: Failing e2e tests:** submitting the worked-example fixture through `/sync/batch` yields a `HealthScore` row with `score: 69, rawScore: 84.494, overrideApplied: "SAFETY_ATTENTION"` and 17 recommendations? no — exactly the adverse results (count the fixture's MONITOR+ATTENTION rows → assert exact count) within 2 s (assert elapsed, NFR-004); the score row is immutable (raw UPDATE attempt via service API → no path exists; Prisma middleware rejects); re-submission of the same inspection (`DUPLICATE`) computes nothing new; `GET .../health-score` matches the API-spec JSON shape including `topDetractors`; history returns scores ordered by `computedAt` with odometer.
- [ ] **Step 2: Implement integration service** (load config by the inspection's stored `checklistVersionId` — never "current active"; map results → engine input; `daysSinceInspection: 0` at compute time; persist; emit).
- [ ] **Step 3: `scores.markStale` daily job** (05:00): set `isStale = true` where `computedAt < now − 90 days` and not already stale (BR-05); test with injected clock at day 90/91 boundary; assert score value untouched.
- [ ] **Step 4: `ScoreGauge` component** — RN SVG (`react-native-svg`) port of the design-system arc: 180° track, band-colored progress arc, display-face numeral, band label EN/FIL, stale variant (grey arc, "inspected {n} days ago" caption), confidence chip. RTL tests: band color mapping for 95/80/69/45/20; stale rendering.
- [ ] **Step 5: Screens.** M-13: gauge + top detractors as plain-language cards (photo thumbnail, recommendation, severity chip) + "why this score?" expandable explaining the override when applied; M-14: per-category bars (band-colored fill, weight caption), tap → findings with photos; M-15: line chart score-vs-time with odometer toggle (`victory-native`), stale zone shading past 90 days; F-09: gauge + "what to tell the customer" summary list. All copy EN with FIL label pairs (NFR-029).
- [ ] **Step 6: Run suites; simulator demo capture→sync→score visible on member app via `score.ready`. Commit** — `git commit -m "feat: score computation pipeline + score surfaces on field and member apps"`

---

### Task 9: Certificates + public SSR pages (M-16, P-01→P-03)

**Files:**
- Create: `apps/api/src/modules/certificates/` (controller, service, `pdf.processor.ts`)
- Create: `apps/web/app/(public)/c/[token]/page.tsx`, `opengraph-image.tsx`, `app/(public)/verify/page.tsx`, `app/(public)/c/[token]/revoked.tsx` (P-03 state)
- Create: `apps/member/src/features/health-score/ShareCertificateScreen.tsx` (M-16)
- Test: `apps/api/test/certificates.e2e-spec.ts`, `apps/web/e2e/certificate.spec.ts` (Playwright)

**Interfaces:**
- Produces: `POST /vehicles/:id/certificates` → `{ publicToken, verificationCode, url }` (`publicToken` = 32 bytes `crypto.randomBytes` base64url ≈ 256 bits; `verificationCode` = 8-char Crockford base32, unique); `PATCH /certificates/:id/visibility { visibility: "PRIVATE" | "LINK" | "REVOKED" }`; `GET /public/certificates/:token` (public, redacted); `POST /public/certificates/verify { code }`.

- [ ] **Step 1: Failing API e2e tests:** token entropy (length + charset assertion); `PRIVATE` cert → public endpoint 404; `LINK` → 200 with score payload containing **no** member name/mobile/email (explicit negative assertions); `REVOKED` → 410 `CERTIFICATE_REVOKED`; verify-by-code returns the matching certificate summary; regenerating a certificate for a newer score leaves old tokens working until revoked.
- [ ] **Step 2: Implement certificates module + PDF processor** (BullMQ `certificates.generatePdf`: renders the public page route to PDF via headless Chromium, stores to Firebase Storage, sets `pdfUrl`; job test asserts a non-empty PDF with the score string present).
- [ ] **Step 3: Public page P-01 (SSR).** Server component fetches by token: gauge (server-rendered SVG — same geometry as RN gauge), band label EN/FIL, category bars, inspection date + odometer + plate (plate is vehicle identity, not personal data — include it; it's the resale subject), service-history summary (count + last 3 service types with dates, no prices), confidence + STALE banner when `isStale` ("Inspected {n} days ago — request a fresh inspection"), verification code, 90-day validity note, disclaimer, primary-deep footer with verify URL. `export const revalidate = 300` + tag-based `revalidateTag(token)` on visibility change (revoke is immediate, not cache-delayed). Unknown/revoked → P-03 notice page with 410 status.
- [ ] **Step 4: OG image route** (`opengraph-image.tsx`, `next/og ImageResponse`): brand card — big score numeral in band color on primary-deep, plate, band label, "AutoCare+ Vehicle Health Certificate". Meta: `og:title` "VHS {score} — {band}", `og:description` with inspection date.
- [ ] **Step 5: Playwright tests:** page renders with JavaScript disabled (SSR proof); OG tags + image URL present and image responds 200; revoked token → 410 notice; verify form happy + miss paths; Lighthouse perf budget on the page ≤2.0 s LCP throttled 4G (NFR-035b) as a CI budget check.
- [ ] **Step 6: M-16 share screen:** generate → native share sheet with the URL; visibility segmented control (Private / Anyone with link); revoke with confirmation (NFR-030) explaining shared links stop working immediately; PDF download/share when ready.
- [ ] **Step 7: Run all suites, commit** — `git commit -m "feat: shareable VHS certificates with SSR public pages and OG previews"`

---

## Phase 4 exit criteria

- Airplane-mode 43-point inspection on the iOS field app; on reconnect a full inspection with 20 photos syncs ≤30 s (NFR-007), forced double-drain creates zero duplicates.
- Golden suite (30+ fixtures incl. 84.494→69) green at 100% branch coverage; DB-config round-trip scores identically; historical recompute reproduces stored scores.
- Member sees score, breakdown, and trend on iOS within 2 s of sync; stale flip verified at day 91.
- Certificate link pasted into Messenger/Viber previews with the score card; page loads ≤2 s on throttled 4G with JS disabled; revoke kills the link immediately.
- Checklist v1.1 publish leaves every v1.0 score untouched and reproducible; mechanic sign-off on thresholds recorded (R-08).
