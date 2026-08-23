# Checkpoint — Phase 4 (Inspection & Vehicle Health Score) Executed (2026-08-24)

Context: after Phase 3 (Scheduling) merged, the user asked to inspect the
checkpoint docs, implement Phase 4, then recheck everything in `apps`. All 10
tasks of the Phase-4 plan were built inline on `main` (same inline-on-main
pattern as Phase 3), each as its own commit. Commits `5a6fa93`→`459637c`.

Plan: `docs/superpowers/plans/2026-08-08-phase-4-inspection-vhs.md`.

---

## What was built (10 tasks, 10 commits)

### `packages/scoring` — pure VHS engine (Tasks 1, 2, 10-pure)
- `computeVHS` reproduces the spec §11.4 worked example exactly (brakes 75.8 →
  raw 84.488 → SAFETY_ATTENTION cap 69, FAIR). Rounding rule per Global
  Constraints. `deriveStatus`, `bandForScore`, `starsFor`/`starsForScore`,
  `renderExplanation` (FR-115 templates + generic fallback). Zero runtime deps.
- 34 golden fixtures + edge + reproducibility + band-token type test. **100%
  branch coverage** on `engine.ts` and `explain.ts` (NFR-039). `seed-config.ts`
  is the single authoring point for the launch checklist (v1.0 / w1.0), shared
  by the golden tests and the DB seed.

### API (`apps/api`)
- **Schema** (`inspection_vhs` migration): `ChecklistVersion/Category/Point`,
  `Inspection`, `InspectionResult`, `HealthScore`, `CategoryScore`,
  `Recommendation`, `Certificate`, `SyncOutboxReceipt` + enums. Append-only
  enforced by a Prisma `$use` middleware that blocks UPDATE on
  HealthScore/CategoryScore/Recommendation/InspectionResult (only
  `HealthScore.isStale` is mutable, for BR-05).
- **Checklists module**: `GET /checklists/active` (ETag=version label, 304),
  admin clone→draft→publish lifecycle (published = immutable, 409 on edit),
  weight-change bumps weightVersion, `preview-score` runs the engine with no
  persistence, all mutations audit-logged.
- **Sync module** `POST /sync/batch`: handler-registry core (Phase 5/6 register
  their entityTypes without touching it), per-item transactions with the
  receipt written inside the item tx, rejected items parked and never blocking
  batch-mates, corrected-replay re-attempts. Inspection create/submit handler
  gates on BR-06 certification + completeness. `GET /sync/status`.
- **Scoring integration**: on submit, computes and persists HealthScore +
  CategoryScore[] + Recommendation[] in the submit transaction (config loaded by
  the inspection's stored version, never "current active"), emits `score.ready`
  via an in-process `ScoreEvents` port. `GET /vehicles/:id/health-score`,
  `/history`, `/inspections/:id`. `scores.markStale` daily job (05:00 Manila).
- **Certificates module**: 256-bit `publicToken` + Crockford base32 code,
  PRIVATE/LINK/REVOKED → 404/200/410, redacted public payload (zero member
  contact data, FR-065), verify-by-code, owner-gated, `certificates.generatePdf`
  BullMQ job (pdfkit) on a dedicated `certificates` queue.

### Web (`apps/web`)
- A-04 checklist editor + A-05 weight editor (live sum gate, side-by-side diff,
  preview-score panel). Public SSR: `/c/[token]` (server-rendered gauge,
  category bars, service summary, stale banner, `revalidate=300`), OG image
  route (`next/og`), `/verify` page, revoked/not-found notice (P-03).
  `pnpm --filter web build` succeeds — all routes compile.

### Field app (`apps/field`)
- Offline core: expo-sqlite WAL store (outbox, local inspections/results,
  photos_pending, kv), `SyncProcessor` (strict-order drain, exponential backoff
  30s·2ⁿ cap 15min, parked rejections, photos-after-receipt, re-entrant-safe),
  `useSyncStatus`, F-03 queue screen.
- Capture flow F-04→F-09: task detail (plate search + odometer), category nav
  (worst-finding accents), giant-chip point entry (live derived status), camera
  + arrow/circle annotation, review/submit gate, score-result screen. Draft core
  is store-injected and jest-covered.

### Member app (`apps/member`)
- Shared `ScoreGauge` (band arc, stale + confidence variants), M-13 score
  screen (gauge + stars + top-detractor cards + "why this score?"), M-14
  breakdown (every category **and** every constituent result tappable →
  `ExplainSheet`, healthy rows included — FR-115), M-15 SVG history chart
  (odometer toggle, stale zone), M-16 share screen (visibility + confirmed
  revoke). `StarRating` derives from the **capped** score (FR-114).

---

## Verification status (the "recheck")

**Green, confirmed:**
- `pnpm turbo run typecheck` — **8/8 tasks pass** (all apps + packages).
- Non-API test suites via `pnpm turbo run test`: **member, field, web,
  contracts, scoring, api-client, design-tokens all pass** (member 82, field 31,
  web 19, scoring 64, contracts 32, …).
- All 5 new API e2e suites (checklist-seed, checklists, sync, scoring-integration,
  certificates = 30 tests) **pass together in-band** and individually.

**Pre-existing API e2e instability (NOT a Phase-4 regression):**
When the full `apps/api` jest suite (264 tests, up from 233) runs, a shifting
subset of **pre-existing** suites flakes/hangs — cash, subscriptions, invoices,
payments-webhook, scheduling, plus the reminders/utilisation unit specs. The
failing set changes between runs; running `subscriptions.e2e` alone *hung* for
9+ min (vs 70s batched) before being killed.

Root cause is the shared **remote Supabase free-tier DB**, exactly the hazard
the 2026-08-23 and Phase-3 checkpoints documented: a low direct-connection
ceiling + cross-suite contention on global tables. Repeated e2e runs during this
session degraded/exhausted the connection pool. Evidence it is not Phase-4 code:
- `scoring-integration.e2e` (the heaviest new suite) **passes even in-band
  alongside** the failing cash/subscriptions suites.
- The only global Phase-4 change is the append-only Prisma middleware, which
  only intercepts UPDATE on 4 score models and passes everything else through —
  cash/subscriptions/scheduling never touch those models.

**To get a clean full api run:** let the Supabase DB idle to recover its
connection pool (or move dev/test to a pooled connection / local Postgres), then
`pnpm --filter api test` fresh. The Phase-3 checkpoint's guidance stands — every
real-DB e2e must scope cleanup to its own prefix and never truncate.

## Deviations & deferrals (flagged, consistent with Phase-3 precedent)
- **Playwright suites deferred** (checklist admin smoke, certificate SSR/OG/
  Lighthouse budget) — same call as Phase 3's deferred board Playwright; needs a
  running Next server + browser in CI.
- **On-device Expo verification deferred** — field capture + member score
  screens are RTL-tested only, no simulator/device run this session.
- **Member jest capped at `--maxWorkers=2`** — adding react-native-svg's heavier
  transforms made the default-parallel run OOM-flake; capped workers is stable
  (all 82 pass). API already runs `--runInBand`.
- **Certificate PDF** renders via pdfkit (self-contained) rather than headless
  Chromium of the public page; the public SSR page is the eventual render source.
- **`score.ready`** is an in-process event port, not yet a Socket.IO gateway;
  the member app refetches on screen focus.

## Not yet committed / open
- The full green `pnpm turbo run test` depends on the remote-DB recovery above.
- Redis still local Docker only; Supabase DB password rotation still deferred
  (per prior checkpoints).
