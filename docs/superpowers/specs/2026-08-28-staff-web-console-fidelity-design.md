# AutoCare+ Staff Web Console Fidelity — Design

**Date:** 2026-08-28
**Status:** Approved for planning
**Scope:** Add the analytics and waste-export endpoints the Admin dashboard needs, then
re-skin `apps/web` to `AutoCare+ Design System/AutoCare+ Staff Web Console.html` —
shared masthead chrome, adoption of the existing component library, and the panels the
mockup has that the app does not.

## Context

The 2026-08-25 design-system incorporation ported a web component library into
`apps/web/components/` and re-skinned two flagship screens. A cross-check of the
extracted Staff Web Console mockup against `apps/web` on 2026-08-28 found the library
is **almost entirely unadopted** — four imports across the whole app — and that the
console has no shared chrome at all.

The mockup bundle is not readable HTML: it is a gzip+base64 resource map on line 372
of the `.html` file, with the screen source in three `text/babel` resources
(`LoginScreen` + `ScheduleBoard`, `WorkOrderScreen` + `AdminDashboard`, and a shared
`TopBar` + fixtures).

### What the app is missing

- **No shared chrome.** Every page invents its own header. Sign-out is duplicated on
  `/staff` and `/admin` and absent from `/staff/schedule` and the work-order page. The
  `--ac-on-deep-body` / `--ac-on-deep-meta` tokens exist for a deep-chrome masthead and
  have no consumer.
- **The component library is unadopted.** `Button`, `FormField` and `EmptyState` have
  **zero** importers; `Card`, `StatusPill` and `Plate` have four between them. Login,
  config, checklists, admin and work-orders all hand-roll Tailwind.
- **The work-order page shadows the real `StatusPill`** with a local one
  (`app/staff/work-orders/[id]/page.tsx`) that always renders `bg-primary-deep`, so
  lifecycle state carries no colour meaning. It also hardcodes `SEVERITY_COLOR` hexes
  instead of band tokens, and renders money in the body face without tabular figures,
  so amount columns do not align.
- **Panels that do not exist:** the Board's "Today" summary aside, the work-order
  health-score rail, and the Admin KPI row, checklist-weights card and DENR waste
  export.

### Data available, and not

| Panel | Data source | Status |
|---|---|---|
| Board "Today" — Booked, Pick-ups | `GET /scheduling/board` response | Available |
| Board "Today" — Bays in use | `GET /scheduling/bays` + appointment `bayId` | Available |
| Board "Today" — Walk-in buffer | operating hours | **`PUT` exists, no `GET`** |
| Work-order health-score rail | `GET /vehicles/:id/health-score` | Available |
| Admin bay utilisation | `UtilisationService.forWindowForUser` | Available |
| Admin checklist weights | `apps/web/lib/checklists/api.ts` | Available |
| Admin MRR / members / churn | — | **Nothing in the repo** |
| DENR waste export | `WasteRecord` rows exist; no read endpoint | **Write-only today** |

## Non-goals

- **`apps/field`** — completed 2026-08-28 on `field-design-system-fidelity`.
- **The Board's roadside-queue card** — Phase 6; roadside does not exist in any app.
- **The work-order entitlements card** — see "Deviations".
- **Drag-to-move on the Board** and **Playwright e2e** — deferred by the Phase 3 plan
  and still deferred.

## Approach

The work splits into two deliverables that ship in sequence, each working software on
its own:

1. **Backend** — the `cancelledAt` migration, an analytics module, and waste export.
2. **Web re-skin** — chrome, primitive adoption, repairs, and the panels (which consume
   what 1 delivers).

One spec, two plans. The backend goes first because three Admin panels block on it.

## Design

### Part 1 — Backend

#### 1.1 `cancelledAt` migration

Cancellation has two paths and **neither records when a subscription actually became
`CANCELLED`**:

- Deferred (`subscriptions.service.ts:249`) sets `cancelRequestedAt` and leaves the
  status `ACTIVE`; `billing.service.ts:191-196` flips it to `CANCELLED` at
  `currentPeriodEnd` — potentially a full billing period later.
- Immediate (`subscriptions.service.ts:267`) sets both at once.

Add `subscriptions.cancelled_at DateTime?`, set at both transition sites. Backfill
existing `CANCELLED` rows with `cancel_requested_at`. The backfill is **approximate for
historical rows only** — deferred cancellations will read early by up to one period —
and the migration says so, so the imprecision is never mistaken for exact.

#### 1.2 Analytics module

New `apps/api/src/modules/analytics/`, admin-gated with the established pattern
(`if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403)`).

**Metric definitions, as decided 2026-08-28:**

```
CONTRACTED = ACTIVE | GRACE | PAST_DUE
```

A member late on payment has not churned; excluding them makes MRR swing on payment
timing rather than on the business.

| Metric | Definition |
|---|---|
| `mrrCentavos` | `Σ normalisedMonthly(plan.priceCentavos, plan.billingInterval)` over CONTRACTED subscriptions. `MONTHLY → price`, `QUARTERLY → price / 3`, `ANNUAL → price / 12` |
| `activeMembers` | `COUNT(DISTINCT userId)` over CONTRACTED subscriptions |
| `churn30d` | `cancelled in the last 30 days ÷ contracted at window start` |
| `bayUtilisation` | delegated to `UtilisationService`, not recomputed |

The arithmetic lives in a **pure `metrics.ts`** — `normalisedMonthlyCentavos`,
`mrr`, `churnRate` — taking plain rows and returning numbers, so it is unit-testable
against golden fixtures with no database. `analytics.service.ts` does the queries and
composes; `analytics.controller.ts` exposes `GET /admin/analytics/summary`.

Money stays in **centavos as `bigint` through the query layer** and is converted once
at the response boundary, matching the existing `priceCentavos` handling. Integer
division for quarterly/annual normalisation rounds to the nearest centavo.

#### 1.3 Waste export

- `GET /admin/waste/summary?from=&to=` → per-type totals for the card.
- `GET /admin/waste/export?from=&to=` → `text/csv` with `Content-Disposition:
  attachment`. Columns: disposal date, work-order number, plate, waste type, quantity,
  unit, hauler, manifest no.

Every export writes an `AuditLog` row (`action: "WASTE_EXPORTED"`, `entityType:
"WasteRecord"`) — that gives the mockup's "Last export 30 Jun 2026" a real source, and
gives a DENR-facing document a compliance trail. The summary endpoint reads the most
recent such row for that line.

Volumes are small (the mockup's own fixture is 42 records per quarter), so the CSV is
built in memory rather than streamed.

#### 1.4 Operating hours read

Add `@Get("operating-hours")` to `SchedulingConfigController`, symmetric with the
existing `PUT`, so the Board's walk-in-buffer row has a source. Three lines plus a
service method; staff-gated like its sibling.

### Part 2 — Web re-skin

#### 2.1 `TopBar` and shell layouts

`components/TopBar.tsx`: 56px `--ac-primary-deep` masthead — brand in the display face
at 22px, a mono uppercase console label ("advisor desk" / "admin console"), nav tabs
with an `rgba(255,255,255,0.12)` active pill, and an outlined Sign out at the right.
Consumes `--ac-on-deep-body` and `--ac-on-deep-meta`.

Applied through `app/staff/layout.tsx` and `app/admin/layout.tsx` rather than pasted
per page. Sign-out logic centralises here, fixing its current duplication and absence.

#### 2.2 Primitive adoption

Login moves onto `FormField` + `Button` and gains the `elevation-raised` token
(currently `shadow-sm`) and 48px inputs (currently `h-11`). Config, checklists and the
staff index adopt `Button` / `FormField` / `EmptyState`. Board and work-orders adopt
`Plate`.

#### 2.3 Work-order repairs

Delete the local `StatusPill` and use `components/StatusPill` with real tones. Replace
`SEVERITY_COLOR` hexes with band tokens. Money and quantities render mono +
`tabular-nums`. Table headers take the display face at `0.02em` in ink.

The health-score rail needs three new web components, which exist only in RN today:
`BandChip`, `StarRating`, `CategoryBar`. They are built as Tailwind components against
the same tokens, each with a test, following the existing `components/` idiom.

#### 2.4 Admin dashboard

The 4-up KPI row (display-34 numerals, `tabular-nums`, uppercase label, delta line),
the checklist-weights summary card, and the DENR export card. The utilisation widget
keeps its logic and gains the mockup's "· next 14 days" heading and threshold caption.

#### 2.5 Board "Today" aside

Layout becomes `grid 1fr 300px`. Booked and Pick-ups derive from the board response,
Bays-in-use from `getBays` against distinct appointment `bayId`, walk-in buffer from
the new operating-hours read.

### Error handling

Every new panel degrades independently: a failed analytics fetch renders `EmptyState`
with a retry inside the KPI region without blanking the page, and the same for the
waste card and the Board aside. A CSV export failure surfaces inline on the card rather
than navigating away. The existing pages' error handling is unchanged.

### Testing

- **API:** golden unit tests for `metrics.ts` (normalisation across all three intervals,
  MRR over mixed statuses, churn with a zero denominator, empty-book cases); service
  specs for admin gating and the CSV serialiser including a row whose optional hauler
  and manifest are null; a spec asserting `cancelledAt` is set on both transition paths.
  Real-DB tests use prefix-scoped cleanup — **never truncate**, the DB is hosted
  Supabase.
- **Web:** a test per new component (`TopBar`, `BandChip`, `StarRating`, `CategoryBar`),
  and tests for the KPI row, the waste card and the Board aside covering loaded, empty
  and failed states. Vitest needs explicit imports — `apps/web` has no globals in tsc.
- Existing suites stay green.

## Deviations, flagged

1. **Board's status→tone map stays as it is.** The mockup sends `BOOKED`, `CONFIRMED`
   and `IN_PROGRESS` all to `info`; the shipped code distinguishes them and documents
   why. Matching the mockup would collapse three states into one colour and lose
   information an advisor uses.
2. **No work-order entitlements card.** `GET /subscriptions/:id/entitlements` exists but
   there is no vehicle→subscription route, and adding a fourth endpoint is outside what
   was asked for.
3. **No roadside-queue card** on the Board — Phase 6.
4. **Churn's historical backfill is approximate** — see 1.1.

## Risks

- **The hosted Supabase DB is the test target.** Prefix-scoped cleanup only; jest
  `testTimeout` is already raised to 30s for remote latency.
- **`apps/api`'s suite was hanging** at the end of the field pass (2026-08-28,
  user-reported, unrelated to that branch). If it still hangs, the analytics specs
  cannot be verified against a live DB and that must be reported rather than worked
  around.
- **`pnpm --filter <app> add`** has twice pruned a sibling workspace's store links. Run
  a root `pnpm install` after any filtered add.
