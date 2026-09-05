# Announcements feed + service reminder fixes

Implements a member-facing Announcements feature and fixes two defects that left
maintenance reminders non-functional.

**Spec:** `docs/superpowers/specs/2026-09-04-announcements-and-service-reminders-design.md`
**Plan:** `docs/superpowers/plans/2026-09-04-announcements-and-service-reminders.md`

> Note: this branch also carries 37 earlier commits from the 2D-vehicle-diagram work that
> were already on it before this feature started. The 22 commits from `c851a9a` onward are
> the announcements work.

## Why

`AUTOCARE MEMBERSHIP APP FEATURES.pdf` promises reminders for oil changes, tyre rotations and
inspections, an appointment reminder before each booking, and an Announcements feature. Two of
those were not working and one did not exist.

## Defects fixed

**Reminders never fired.** `dueCandidates()` selects only service types carrying an interval, but
`seed-scheduling.ts` seeded none. The query returned nothing, the daily 08:00 job short-circuited,
and zero reminders had ever been created on any seeded environment. Unit tests passed because they
built their own fixtures.

**The last-service date was never captured.** The client doc says members enter it at registration;
nothing collected it, so the reminder baseline silently fell back to the vehicle's `createdAt` —
a car serviced last week and one serviced two years ago were treated identically.

## What this adds

- **Announcement threads that update in place** rather than accumulating notifications:
  `Oil Change due` → `scheduled for Sep 12` → `completed`. One row transitioning, driven by a
  pure state machine (`announcement-thread.ts`, 18 unit tests over every transition).
- **A T-24h appointment reminder job** — the PDF's "the app sends a reminder before the
  appointment", which had no implementation at all. Hourly, idempotent via the state machine.
- **Member Announcements screen** with unread badge, reachable from the Account tab.
- **Admin broadcast console** at `/admin/announcements` (A-16, FR-107).
- **Announcements is now the single source for `SERVICE_DUE`** in the attention dashboard;
  `service_reminders` is dropped. The other three attention kinds stay computed views.

## Notable decisions

- The open-thread unique index is **partial** (`WHERE status = 'ACTIVE'`). A total constraint
  would block the next service cycle, since closed threads remain as history. Prisma cannot
  express partial uniques, so it lives in raw migration SQL and lookups use `findFirst`.
- `Announcement → Vehicle` is `ON DELETE CASCADE`. The default `SET NULL` orphaned threads, which
  then sat in a member's feed claiming a service was due on a car they no longer owned.
- Dismissing a **broadcast** is per-viewer. Setting `status = DISMISSED` on that shared row would
  have blanked the notice for every member; a regression test asserts it stays `ACTIVE` and
  remains visible to others.

## Not included

- **Push/SMS transport** (FR-090/091), notification preferences, quiet hours. This builds the
  content and feed layer; until transport lands, "sends reminders" means in-app only.
- **`SERVICE_COMPLETED` is unwired** — nothing in the codebase sets `Appointment.status =
  COMPLETED` (it is only ever read). The state machine supports it; the trigger does not exist.
- **Service catalogue mismatch**: the seeded catalogue does not match the PDF/SRS list (PMS, OBD
  Scanning, Underchassis, Aircon, Body Repair & Repaint, Parts & Accessories). Placeholder dev
  data with pricing implications — needs a product decision before launch.

## Also fixed here

`subscriptions.e2e-spec.ts` used hardcoded fixture ids while every other suite scopes to a
per-run TAG, and its `afterAll` deleted only 2 of the 9 vehicles it creates. Seven leaked each
run; after an aborted run, re-inserting a `UNIQUE` plate blocked on the previous holder's row
lock and surfaced as a 30s timeout. Now TAG-scoped with prefix cleanup.

## Verification

`pnpm turbo run typecheck lint test` — 20/20 tasks green.
API 67 suites / 462 tests. A 10-step end-to-end journey drives the whole lifecycle over real
HTTP against real Postgres, real Redis holds and the real capacity engine.

**Owed manual checks** (cannot run headless): on-device Expo pass over the Announcements screen
and Account badge; `/admin/announcements` against a live API session in a browser.
