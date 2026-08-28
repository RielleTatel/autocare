# Staff Web Console Fidelity — Executed

**Date:** 2026-08-28
**Branch:** `staff-web-console-fidelity` (branched from `main` @ `d5a29ce`; 13 commits, NOT merged/pushed)
**Spec:** `docs/superpowers/specs/2026-08-28-staff-web-console-fidelity-design.md`
**Plans:** `docs/superpowers/plans/2026-08-28-admin-analytics-waste-export.md`,
`docs/superpowers/plans/2026-08-28-staff-web-console-reskin.md`

Branched from `main`, not from `field-design-system-fidelity` — the two passes touch
disjoint apps and should be reviewable independently. The field work remains intact on
its own branch.

## Why

A 2026-08-28 cross-check of `AutoCare+ Design System/AutoCare+ Staff Web Console.html`
against `apps/web` found the component library shipped in the 2026-08-25 pass was
almost entirely unadopted (`Button`, `FormField`, `EmptyState` had **zero** importers),
the console had no shared chrome at all, and three Admin panels had no data source.

## Part 1 — Backend

- **`cancelledAt` migration** (`20260828120000_add_subscription_cancelled_at`). Neither
  cancellation path recorded when a subscription actually ended: the deferred path sets
  `cancelRequestedAt` and leaves the status `ACTIVE` until the billing job flips it at
  period end, up to a full billing period later. Churn was therefore not computable.
  Stamped at both transition sites; existing `CANCELLED` rows backfilled from
  `cancel_requested_at`, **approximate for historical rows only** and flagged as such in
  the migration.
- **Analytics module** (`apps/api/src/modules/analytics/`), admin-gated. Arithmetic
  lives in a pure `metrics.ts` so the money maths is testable without a database.
  `GET /admin/analytics/summary` → `{ mrrCentavos, activeMembers, churn30d,
  bayUtilisation }`. **Metric definitions as decided this session:** `CONTRACTED =
  ACTIVE | GRACE | PAST_DUE` (a member late on payment has not churned); MRR normalises
  `QUARTERLY → /3` and `ANNUAL → /12` onto a monthly basis, rounding to the nearest
  centavo; churn is cancellations in the window over the population contracted when it
  opened; utilisation delegates to the existing `UtilisationService`. `mrrCentavos` is
  a decimal **string** — it is bigint server-side and JSON has no bigint.
- **DENR waste export.** `GET /admin/waste/summary` and `GET /admin/waste/export`
  (RFC 4180 CSV). Every export writes an `AuditLog` row (`WASTE_EXPORTED`) — it is a
  regulator-facing document, so it needs a compliance trail, and it gives the dashboard
  card its "last exported" date.
- **`GET /scheduling/operating-hours`**, symmetric with the existing `PUT`, feeding the
  board's walk-in-buffer row.

**Not in the plan, added because it was necessary:** the global `EnvelopeInterceptor`
wrapped *every* response in `{ success, data }`, which would have corrupted the CSV
download. Added a `@RawResponse()` opt-out with a test pinning both behaviours.

## Part 2 — Web re-skin

- **`TopBar` + `StaffShell`**, mounted from `app/staff/layout.tsx` and
  `app/admin/layout.tsx`. Sign-out was duplicated on `/staff` and `/admin` and absent
  from the schedule board and work-order pages; it now lives in one shell. Consumes the
  `--ac-on-deep-body` / `--ac-on-deep-meta` tokens, which had no consumer before.
- **Three new score components** — `BandChip`, `StarRating`, `CategoryBar` — which
  existed only in React Native. Band colours resolve through `bandVar()` so no caller
  inlines a protected hex.
- **Work-order repairs.** A local `StatusPill` shadowed the shared one and rendered
  every lifecycle state the same navy, so state carried no colour meaning; severity
  dots used hardcoded band hexes; money rendered in the body face so amount columns did
  not align. All three fixed, plus the display-face table header and the `Plate`
  primitive.
- **New panels:** the advisor health-score rail (the endpoint existed and nothing
  consumed it), the board's "Today" aside, and the Admin KPI row, checklist-weights
  card and DENR export card. Each fetches independently — one dead call never blanks a
  page.
- **Login** onto `FormField` + `Button`, the `--ac-elevation-raised` token and 48px
  inputs.

## Verify

- **`apps/web`: 72/72 tests pass, typecheck clean.** No `lint` script exists in that
  workspace, so there was nothing to run.
- **Component adoption**, non-test importers: `Button` 0→5, `FormField` 0→1,
  `EmptyState` 0→1, `Plate` 2→3, `Card` 7, `StatusPill` 2, plus the three new score
  components and `TopBar` (via `StaffShell`). Every component now has a real consumer.
- **No raw band hexes** remain in `app/` or `components/` — the only matches are the
  assertions that forbid them.
- **`apps/api`: all 27 specs pass individually** (26 new tests added).

## The API suite hang

`cd apps/api && pnpm test` produces **zero output for 9+ minutes**; every spec run
individually finishes in ~2s. This is the hang the user reported earlier on 2026-08-28
and it is **not caused by this branch** — it reproduces the same way. Per the plan, it
was not worked around: every spec was verified in isolation instead.

**Two pre-existing failures**, confirmed identical at base commit `d5a29ce` in a
throwaway worktree:

- `utilisation.service.spec` — a real-DB test expecting 2 bays where hosted Supabase now
  has 4. Shared-database pollution, not a logic defect.
- `reminders.service.spec` — 1 failure, same at base.

Neither is mine. Both are owed a fix, tracked here rather than silently absorbed.

## Deviations, flagged

1. **The board's status→tone map stays richer than the mockup.** The mockup sends
   `BOOKED`, `CONFIRMED` and `IN_PROGRESS` all to `info`; the shipped code distinguishes
   them and documents why. Matching the mockup would collapse three states into one
   colour and lose information an advisor uses.
2. **No work-order entitlements card** — `GET /subscriptions/:id/entitlements` exists but
   there is no vehicle→subscription route, and adding a fourth endpoint was outside the
   ask.
3. **No roadside-queue card** on the board — Phase 6; roadside does not exist in any app.
4. **Churn's historical backfill is approximate** — see Part 1.
5. **Config's inputs keep their placeholders** rather than moving to `FormField`: they
   sit in tight inline rows with no visible labels, which is not what that primitive is
   for.

## Owed

- **Re-run the full monorepo gate** (`pnpm turbo run typecheck lint test`) once the
  `apps/api` suite hang is fixed. It was not run to completion this session.
- **Fix the two pre-existing scheduling spec failures** (shared-DB pollution in
  `utilisation.service.spec`; `reminders.service.spec`).
- **Live-API smoke test** of the new Admin panels and the CSV download — the panels are
  RTL-tested against mocked fetchers, never against a running API.
- **Playwright e2e** for the board and work-order flows — deferred by the Phase 3 plan
  and still deferred.
- Branch is **not merged or pushed**, and neither is `field-design-system-fidelity`.
  Both await a decision on how to land.
