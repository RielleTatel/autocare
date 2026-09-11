# Checkpoint — Phase 3 (Scheduling & Capacity) Executed & Pushed (2026-08-24)

Context: after the SecureStore crash fix and the Docker→Supabase DB migration
(see the 2026-08-23 checkpoint), the user asked to execute Phase 3. The draft
plan was expanded to a full step-level TDD plan, then all 8 tasks were built
inline on `main` (the user chose inline execution, directly on main, and "run
everything against Supabase"). A web→API auth bridge was added as a prerequisite
that surfaced mid-build. Everything is committed and pushed to `origin/main`.

Commits `4e9b81a`→`857227f` (11 commits). `pnpm turbo run typecheck test` =
17/17 green (api 233, web 19, member 78, + package suites).

---

## What was built

Full plan: `docs/superpowers/plans/2026-08-08-phase-3-scheduling.md` (expanded
from DRAFT this session).

### API kernel (Tasks 1–5) — `apps/api/src/modules/scheduling/`
- **Schema + contracts** — `ServiceType`, `ServiceBay`, `StaffShift`,
  `OperatingHours`, `CapacityBlock`, `Appointment` (+ `AppointmentStatus`,
  `Weekday` enums); Zod contracts in `packages/contracts/src/scheduling.ts`.
  Migration `20260823142924_add_scheduling_capacity`.
- **Capacity engine** (`capacity-engine.ts`) — pure kernel: a slot needs a
  capable bay AND a skilled mechanic on shift (two-resource constraint),
  per-instant concurrency cap, walk-in buffer withholding. 12 golden tests.
- **Redis holds + slot query** — new `RedisModule` (`ioredis`), 10-min
  `SET NX EX 600` holds, atomic Lua `GET+DEL` claim used as the booking mutex.
  `SchedulingService.slots` batches the whole window in ~6 queries (not per
  day), so a 30-day query runs in ~490 ms against remote Supabase (NFR-005).
- **Appointments** — book (claims hold → consumes a Phase-2 entitlement →
  creates row; overage surfaced via a new `DomainError.details` channel),
  reschedule (free ≥24 h; <24 h → advisor-only), cancel (entitlement refund
  when ≥24 h out), nightly `flagNoShows` (past BOOKED/CONFIRMED → NO_SHOW,
  ≥3-in-6-months → admin `AuditLog`).
- **Reminders** — `dueCandidates` from manufacturer intervals (time since last
  COMPLETED service / odometer delta), `serviceDue` persists in-app
  `ServiceReminder` rows only on each vehicle's FNV-1a stagger bucket (28-day
  spread, load shaping). Migration `20260823150157_add_service_reminders`.
- BullMQ schedules (Manila tz): `flagNoShows` 05:00, `reminders.serviceDue`
  08:00, `capacity.utilisationAlarm` 06:00.

### Web→API auth bridge (unplanned prerequisite, reusable Phases 5–7)
The staff web had no way to authenticate to the API — it holds a jose-sealed
`ac_session` cookie `{uid=User.id, role}`, but the API's `AuthGuard` only
accepted Firebase tokens. **User chose the shared-session-secret option.**
- API `AuthGuard` now opens the sealed `ac_session` (SHA-256-derived key from a
  shared `SESSION_SECRET`, byte-identical to `apps/web`) before falling back to
  Firebase. Still loads the user + re-checks status/role. `SESSION_SECRET` added
  to the API env schema + `.env` + CI (`jose` added to the API).
- Web BFF proxy `apps/web/app/api/proxy/[...path]/route.ts` forwards requests to
  the API attaching the httpOnly cookie as Bearer (pure auth-forwarding, no
  domain logic — allowed by Architecture §7.4a).

### Config + board + UI (Tasks 6–8)
- **API config** — staff-gated CRUD for bays / shifts / service-types / blocks /
  operating-hours (upsert by weekday or date override); `GET /scheduling/board`
  (date-range appointment feed with plate + member name); utilisation FR-052
  (`GET /admin/capacity/utilisation`, daily alarm).
- **Web** — advisor board `/staff/schedule` (hour-grouped cards, prev/next/today,
  cancel), capacity config `/staff/config`, admin utilisation widget.
- **Member (Expo)** — booking flow `apps/member/src/features/booking/` (M-19→23:
  service select w/ entitlement badge, slot picker w/ live 10-min hold countdown
  + expiry re-pick, confirm w/ entitlement line, bookings list). Wired into
  `RootNavigator` (Booking / Bookings) + a Home "Book a service" entry.

---

## Decisions & deviations (all YAGNI, flagged to the user)
- **Reminders → a Phase-3 `ServiceReminder` table**, not a Phase-7 Notification
  model (kept the phase self-contained; Phase 7's notification centre can read
  these rows later).
- **No-show / utilisation flags → `AuditLog` action strings**
  (`NO_SHOW_REVIEW_FLAGGED`, `UTILISATION_ALARM`), not new error codes (they're
  never thrown to a client).
- **Global jest `testTimeout` raised to 30 s** — remote Supabase per-query
  latency exceeded the 5 s default on multi-step real-DB e2e (this also fixed a
  pre-existing billing e2e that timed out once the DB went remote).
- **bigint-serializer loaded in jest setup** — it was only imported in
  `main.ts`, so endpoints returning raw `BigInt` money fields 500'd in e2e until
  the same side-effect patch ran in tests (matches prod behaviour).

## Testing notes (important going forward)
- The dev/test DB is now **hosted Supabase**. Every real-DB e2e MUST scope its
  cleanup to its own fixtures with a unique prefix and NEVER truncate — verified
  by running suites twice with zero residual rows. `afterAll` cleanup is wrapped
  in try/finally so `app.close()` always runs (an aborted teardown leaves
  Redis/BullMQ handles open and jest hangs).
- `operating_hours` `dateOverride` rows are keyed by a **global** calendar date
  (not tag-scoped), so tests defensively pre-delete their far-future test dates
  in `beforeAll` to survive a crashed prior run.

## Push hygiene (what happened at push time)
- A pre-push secret scan caught the **Supabase DB password in prose** inside the
  2026-08-23 checkpoint doc (a "rotate this" note). It was scrubbed from **all
  11 outgoing commits** via `git filter-branch` on the `origin/main..HEAD` range
  **before** pushing, so the password never reached GitHub. Also redacted in the
  local auto-memory. (User has since said the password is not a concern.)
- Pushed `83b323d..857227f` to `origin/main`; branch is in sync (0 ahead / 0
  behind).

## Still local / not committed
Pre-existing uncommitted working-tree changes were deliberately left alone
(stashed during the history rewrite, then restored intact): the SecureStore fix
(`apps/member/app.json`, `package.json`, `eas.json`, `app.config.js`), edits to
the phase-4 / phase-6 plan docs, and a few untracked docs/checkpoint files.

## Deferred (documented in the plan, not built)
- Board **drag-to-move** + Playwright e2e for the schedule board.
- **On-device Expo verification** of the member booking flow (RTL-tested only —
  no device run this session).
- Redis still **local Docker only** — needs a hosted equivalent (e.g. Upstash)
  before any real deployment.
- Supabase DB password rotation (user has chosen to defer).
