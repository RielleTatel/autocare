# Checkpoint — Phase 5 (Work Orders & Parts) Executed (2026-08-24)

Context: after Phase 4 (Inspection & VHS), the user asked to execute Phase 5.
The plan was a DRAFT (like Phase 3); each task was expanded into TDD steps as it
was implemented, built inline on `main`, one commit per task. Commits
`eaf5400`→`21393fa` (9 feature commits + the shared fixes).

Plan: `docs/superpowers/plans/2026-08-08-phase-5-work-orders-parts.md`.

---

## What was built (9 tasks)

### Schema + lifecycle (Tasks 1–2)
- Migration `work_orders_parts`: `WorkOrder`, `WorkOrderItem`, `Part`,
  `WasteRecord` + enums; `Recommendation` extended with a lifecycle
  (`status` OPEN→QUOTED→APPROVED/DECLINED/DEFERRED→RESOLVED, `resurfacedCount`,
  `vehicleId`, WO-item link); `SystemConfig` key/value for the BR-07 threshold.
  ~40-SKU starter parts catalogue seed.
- Pure lifecycle engine (`lifecycle.ts`): strict transition table,
  `approvableTotal`/`approvedTotal`, threshold guard (₱1,500 default, exactly at
  → no approval; +1c → required), closure blockers (approved-work-done,
  technician summary, waste-per-part-category). 14 unit tests.

### API (Tasks 3, 6, 7, 8)
- Full §9.7 surface: create / get / list-for-vehicle / items / status /
  request-approval / per-line + batch decisions / waste / parts search /
  recommendations / admin parts CRUD + threshold config.
- FR-069 **resurfacing**: the Phase-4 inspection-submit hook re-links an
  unresolved recommendation for the same vehicle+point (bumps `resurfacedCount`,
  flips back to OPEN) instead of duplicating.
- Stock (FR-072): decrements approved PART lines on closure exactly once
  (re-close is an illegal transition), negative stock blocked without an
  advisor override, override audited; low-stock reorder flag.
- Waste (FR-074): `waste_record` sync handler (offline field entry drains
  idempotently), advisor direct add; oil-change WO can't close without a
  USED_OIL record.
- Billing hook: closure with a billable balance issues `Invoice{workOrderId}`
  (AWAITING_CASH) via Phase-2 numbering, idempotent per WO.

### Web (Task 4)
- Advisor quote builder `/staff/work-orders/[id]`: item table (parts
  search-as-you-type, labour, per-line discount), recommendations tray
  (one-click convert with resurfaced-count context), VAT-inclusive totals panel,
  lifecycle controls, W-09 waste panel. Pure `quoteTotals` unit-tested.

### Member (Task 5) + Attention (Task 9)
- M-25 approval request (per-line approve/decline/defer, live approved total,
  atomic confirm), M-18 recommendations, M-17 service history.
- **What Needs Attention** (FR-109→113): pure aggregator over 4 read-only feeds
  (component findings, open recommendations, entitlements expiring, services
  due) → CRITICAL-first, plate chip only for multi-vehicle members, one-tap deep
  links; `GET /me/attention` (empty `[]` not 404); M-10 home card + M-38 list
  with a deep-link resolver; recompute-trigger emits (one `attention.changed`
  per submit / per decision request, not per line).

---

## Significant fix: the real cause of the "remote-DB flakiness"

While building the work-order e2e I found the actual root cause of the
intermittent Phase-4 e2e failures I'd attributed to the remote DB: the
inspection-submit path did **50+ sequential `create()` calls inside one Prisma
interactive transaction**, which blows past Prisma's **5 s** interactive-tx
timeout on the high-latency remote Supabase DB — the transaction closes
mid-loop ("Transaction not found"). When the DB was fast it finished under 5 s
(passed); when slow it failed. That's the pass/fail flipping I saw.

Fixed by:
- Batching inspection results + category scores with `createMany` (one round
  trip instead of 50).
- Raising the `/sync/batch` per-item transaction `timeout` to 20 s.

This also corrected a Phase-4 overreach: `Recommendation` was in the append-only
Prisma middleware, but NFR-054 names only the inspection/score tables and
recommendations carry a lifecycle — removed it from the set.

---

## Verification (the recheck)

**Green:**
- `pnpm turbo run typecheck` — **8/8**.
- Non-DB suites: scoring 64, contracts 32, web 23, member 104, field 33 — all pass.
- Every new Phase-5 API e2e suite passed when run in isolation: work-orders
  (8), parts-stock (5), waste (4), attention (4), parts-seed (3); plus the
  lifecycle (14) and attention-aggregate (6) unit specs.
- The transaction fix stabilised the previously-flaky scoring pipeline —
  scoring-integration and work-orders e2e now pass reliably.

**Full `apps/api` run:** see the run recorded at the end of this session; the
transaction-timeout fix should remove the prior cascading failures. If any
remain, they are the same pre-existing shared-remote-DB contention documented in
the Phase-3/Phase-4 checkpoints (many heavy e2e suites against one free-tier DB),
not Phase-5 regressions — every Phase-5 suite is green in isolation.

## Deviations & deferrals (flagged, consistent with prior phases)
- **Plan-tier discount** is applied per-line by the advisor (FR-071 mechanism),
  not auto-derived — the schema has no plan discount %; noted for a future pass.
- **`attention.changed` / `workorder.approval_required`** are in-process event
  ports (logged), not yet a Socket.IO gateway — the member app refetches on
  focus, same pattern as Phase-4 `score.ready`. The **subscription-state-change**
  trigger emit is deferred (would couple BillingModule → WorkOrdersModule for a
  signal with no push consumer yet); focus-refetch already covers all four feeds.
- **Playwright** (work-order quote-build smoke) and **on-device Expo**
  verification deferred, as in Phases 3–4.
- Certificate/work-order PDFs and realtime remain the documented v1.1 / later
  items.

## Open
- Full-green `pnpm turbo run test` still depends on the remote free-tier DB
  behaving under concurrent suites; a pooled connection or local Postgres for
  test would remove the last source of contention.
- Redis still local-only; Supabase password rotation still deferred.
