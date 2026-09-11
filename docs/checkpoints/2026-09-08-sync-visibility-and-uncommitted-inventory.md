# Checkpoint — Sync Failure Visibility, Health Score Verification & Uncommitted Work Inventory

**Date:** 2026-09-08
**Branch:** `feat-2d-vehicle-diagram` (also merged into `main`)
**Status:** This session's work is committed and pushed to `origin/main`. A separate, larger body of prior work (68 files) remains uncommitted and local-only — see Part 2.

---

## Part 1 — What's on remote `main` right now

`origin/main` is at `5612f57`. Everything reachable from it is pushed; nothing described in this section is at risk of being lost.

### Already there before this session (PR #1, merged 2026-09-05/06)

Two feature waves, developed on `feat-2d-vehicle-diagram` and merged via GitHub PR #1:

1. **2D vehicle diagram** (FR-116/117) — tappable, colour-coded car diagram in the member app's Health Score screen, built end-to-end from a new `checklist_points.diagram_zone_id` column through to the UI. Full detail in `docs/checkpoints/2026-08-29-member-reskin-and-vehicle-diagram.md`.
2. **Announcements** — member notification feed, admin broadcast console, dismiss/read-all semantics, and a scheduling-reminders rewrite that replaced the old `service_reminders` table with announcement threads. ~15 commits, `packages/contracts/src/announcements.ts` onward.
3. **Member app re-skin** — all seven screens from the UI/UX brief.
4. **Scheduling fixes** — several booking defects, some silently wrong for a while before being caught.

### Added this session

One commit, `9efb17a`, merged into `main` as `5612f57`:

- **Sync failure visibility (field app).** Every `syncProcessor.drain()` caller was `.catch(() => undefined)` — a failed sync had no path to the technician. `SyncBanner` keyed off `pendingCount` alone, so once entries moved to `REJECTED` the count hit 0 and the banner vanished, making a permanently stuck queue look like a fully-synced app. Fixed: `SyncProcessor` now tracks `lastError`; `SyncBanner` gains distinct failing/rejected states.
- **`CHECKLIST_INVALID` now names both ids** — the checklist version id the server received and the one currently active — so a stale-cache rejection is diagnosable from the error text alone instead of just a code.
- **Member health score refetches on focus** (`HomeTabContainer`, `VehicleDetailContainer`, `HealthScoreContainer` in `RootNavigator.tsx`) — previously fetched once on mount, so a score computed while the screen stayed mounted (the common case, since React Navigation keeps screens alive) was never picked up.

**Why this was needed:** live testing against vehicle **ABA1234** turned up a real bug chain — the field app's on-device cache held a `checklistVersionId` from an earlier database seed. Every submission was silently rejected server-side (`CHECKLIST_INVALID`), but the banner showed nothing because rejected items don't count as "pending." Four submission attempts failed identically before the cache was cleared by reinstalling the app; the fifth attempt succeeded and produced a real score (**100 / EXCELLENT**, confirmed in the database). The fixes above exist so the next person hitting this doesn't need four silent failures and a git-log archaeology session to find it.

**Verified:** field 130/130, member 236/236, api sync e2e 10/10, all typechecks clean. Each new test was watched failing before the fix, per TDD.

---

## Part 2 — Uncommitted work (68 files, local-only)

This is **not** work from this session. It was already sitting in the working tree when this session started — written and manually tested in earlier sessions, but never `git commit`ed. Nobody in this conversation knows the original reason it was left uncommitted; the most likely explanation, based on how cleanly each group lines up with its own tests, is that it was paused mid-session rather than abandoned or broken.

A read-only scan of every file's actual diff (not just filenames) found **no TODOs, no commented-out code, no broken imports, no console.logs** — every group below has matching tests and reads as finished, not partial.

| Group | What it does | State |
|---|---|---|
| **Staff/user admin** (api `users.*`, web `admin/staff/`, `lib/users/`) | Admin-only staff directory (`GET /users/staff`), role assignment (`PATCH /users/:id/role`) with two lockout guards — can't self-demote, can't demote the last active admin — and clears future shifts on role change. | Finished. 8 unit + 16 e2e + 1 page test. |
| **Scheduling config** (api `scheduling-config.*`, web `staff/config/Shifts.tsx`) | Shift CRUD, `listRosterableStaff`, an `assertTimeOrder` guard rejecting inverted shift times. | Finished, tested. **One self-flagged gap**: a code comment admits `MECHANIC` was added to `STAFF_ROLES` "for the board only" but this also grants capacity writes, which the comment calls "wrong ... tracked separately." Known, not hidden. |
| **Field sync hardening** (`discard.ts`, `SyncQueueScreen.tsx`, outbox repos) | Lets a technician permanently discard a `REJECTED` outbox entry — its dependent submit, photos, and local draft row — since a rejection's payload is frozen at enqueue and can never succeed on retry. | Finished. 5 tests in `discard.test.ts`. |
| **Field vehicle history** (`features/history/`) | New `historyApi.ts`, `VehicleHistory.tsx`, `InspectionDetailScreen.tsx` — lets a mechanic see a vehicle's past inspections. This is the "reference point for past inspections" feature discussed earlier in this session; it already exists, just isn't committed. | Finished. 11 tests across both screens. |
| **Member app screens** (`HomeScreen.tsx`, `AccountScreen.tsx`, booking screens) | Relocates the unread-announcements badge from the Account tab to a new bell icon in the Home masthead, reachable without leaving Home. Booking-screen diffs are 1–2 lines each (a shared prop/type change). | Finished. 5 new `HomeScreen` tests. |
| **Web staff console** (`Board.tsx`, `DayGrid.tsx`) | Small (22–25 line) diffs, both with matching tests. | Finished. |
| **API misc** (`inspections.service.ts`) | One-line fix exposing `inspectionId` distinctly from the `HealthScore`'s own `id`, so history rows can open their underlying inspection. | Finished. 8-test e2e spec covers the path. |
| **Workspace/docs** (root `package.json`, README, plan `.md` files, 3 checkpoint docs) | Adds `concurrently`-based `serve:*` scripts to run api+web/member/field together; trivial README/plan edits; three already-complete checkpoint documents that were simply never `git add`ed. | Cosmetic/tooling only. |

**Excluded from all of the above (and from any future commit) — not features, not part of the app:**

- `.obsidian/` — an Obsidian vault config folder
- `_tmp_62439_7708bd6f7bf7a07ba54d9ffc724495d6` — an empty stray temp file
- `AutoCare+ Design System/` and `AutoCare+ Docs/` — personal reference/notes content sitting in the repo root, unrelated to the app codebase

### Why these are still uncommitted

Per explicit instruction this session (**"Nvm do not commit it anymore"**), none of the above was committed or pushed. It remains exactly as it was: on disk, on the `feat-2d-vehicle-diagram` branch, working-tree only. It is real, tested, finished-looking work — just not yet in git history, and therefore not on any remote. If this machine were lost today, this batch would be lost with it.

---

## Known issue carried forward (not caused by this session)

Running the full API suite this session reproduced a pre-existing flake: **8 of 463 tests failed, all in `announcements.e2e-spec.ts`, all `Exceeded timeout of 30000ms`.** Two likely-orphaned `jest --runInBand` processes were found already running since Saturday, competing for the same dev Postgres/Redis — the probable cause, and consistent with the announcements suite's documented flake history (commit `20e4336`, "kill the subscriptions flake"). Not investigated further this session; flagging so it isn't mistaken for a regression introduced today.

---

## Bottom line

- **Deployed to remote `main`:** vehicle diagram, announcements, member re-skin, scheduling fixes, and this session's sync-visibility work. All verified with passing tests.
- **On your machine only, not on any remote:** staff/user admin, scheduling config UI, field sync-discard, field vehicle history, member screen polish, web staff console polish — six finished feature areas, 68 files, zero commits.
