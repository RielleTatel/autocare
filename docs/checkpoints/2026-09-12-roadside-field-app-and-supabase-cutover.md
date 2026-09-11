# Checkpoint — Roadside responder app, notifications, and the Supabase cutover

**Date:** 2026-09-11 → 2026-09-12
**Branch:** `main` (everything below is committed and pushed; `origin/main` at `1959bb8`)
**Database:** switched from local Docker Postgres to **Supabase** (Singapore) during this session

---

## 1. Roadside assistance, responder side (F-17, F-18)

The member-facing roadside path shipped earlier the same day. What was missing was the other half:
the people who answer the call.

- **F-18 dispatch queue** — open incidents oldest-first, assign a responder with an optional ETA.
- **F-17 response screen** — a driver walks a call `DISPATCHED → EN_ROUTE → ON_SITE → RESOLVED`,
  then closes it with notes and a cost.
- **Entry point** on the field home screen, gated to `DRIVER`/`ADVISOR`/`ADMIN`, mirroring the
  server's own `DISPATCH_ROLES`. A mechanic never sees it.

**Navigation is a hand-off, not a map.** "Open in maps" passes coordinates to whatever maps app the
phone has (`Linking.openURL`, React Native core). A driver needs turn-by-turn, which an embedded
map cannot give, and this matches the choice already made for pick-up trips (F-13). The practical
consequence: **no new native module, so the existing field dev client kept working.**

### Two defects found by using it, not by testing it

- **Dispatch recorded a name, not a person.** `dispatchedToUserId` stayed null, so a driver was
  never routed to their own call. Fixed with a narrow `GET /roadside/responders` (ACTIVE drivers,
  dispatch roles only) — narrow rather than reusing the ADMIN-only `/users/staff` directory, which
  carries contact details an advisor does not need. A typed name still works, because FR-037 also
  covers contracted tow partners, who have no account.
- **The queue never refreshed.** It loaded once. Now it re-reads on focus and every 15 s while on
  screen, pausing behind an open call.

---

## 2. Notifications — the two silent moments

Two events produced nothing at all:

- **`SERVICE_COMPLETED`** existed in the Prisma enum, the transition table *and* the copy renderer,
  and nothing ever emitted it. Closing a work order — the moment a member most wants to hear from
  us — told nobody. Now emitted from `WorkOrdersService.close()`.
- **Roadside status changes** reached only the member watching the live screen. Now a
  `ROADSIDE_UPDATE` announcement, keyed on the incident rather than a service type (an incident has
  none), superseded on each change so one call-out leaves one row rather than four. `REQUESTED` and
  `ACKNOWLEDGED` write nothing — the member is still on the screen they submitted from.

Both paths are best-effort: a feed write must never roll back a stock decrement or undo a status a
responder already drove.

> **None of this reaches the phone's notification shade.** That needs push (FCM), which is not
> built. The in-app work matters because `applyThreadEvent` is the single chokepoint push would
> later send from. FCM itself is free on Firebase's Spark plan; the real costs are a native rebuild
> of both apps and, for iOS, the $99/year Apple account for APNs.

---

## 3. The Supabase cutover, and what it exposed

`DATABASE_URL` had drifted to local Docker. Pointing it back at Supabase surfaced three things.

### The project was paused, not broken

`nslookup` returned NXDOMAIN — the free-tier project had paused after inactivity, exactly as
`07 System Architecture.md` warns. Resuming restored it; Storage then returned `DatabaseTimeout`
(HTTP 544) for ~2 minutes while Postgres started. **All three Supabase keys were correct throughout** —
including a `sb_secret_…` key, which is the current format that replaced the old `service_role` JWT.

Supabase was **8 migrations behind** (14 of 22, no `roadside_requests`). Applied, then seeded.

### The performance finding — the important part of this session

| Endpoint | Before | After | NFR-002 (p95 ≤ 500 ms) |
|---|---|---|---|
| `/plans` | 419 ms | **125 ms** | PASS |
| `/vehicles` | 894 ms | **192 ms** | PASS |
| `/roadside/eligibility` | 1195 ms | **252 ms** | PASS |
| `/me/attention` | 3230 ms | **443 ms** median, 878 p95 | fails on p95 |

Two separate causes, and **the obvious one was not the main one**:

1. **Query fan-out** (fixed in `attention.service.ts`). `componentFindings` looped per vehicle with
   a four-level nested include. Real, but worth only ~100 ms here — the test member owns one
   vehicle. It matters for members who own several.
2. **The connection mode** (the actual cause). Under `?pgbouncer=true` on the transaction pooler,
   Prisma wraps every read in `BEGIN` / `DEALLOCATE ALL` / `COMMIT` — **four round trips per
   logical query**, ~60 ms each at this distance. Same five reads: **2707 ms pooled vs 427 ms on
   the session pooler.** `DATABASE_URL` now uses the session pooler (`:5432`).

**This invalidates advice in `2026-09-11-backend-deployment-design.md`**, which recommends the
transaction pooler with `pgbouncer=true`. That spec needs updating before anyone deploys from it.

**And it reframes the deployment plan.** The spec puts the API on Render's **US** free tier. US ↔
Singapore is ~200 ms a round trip against ~80 ms from here, so the same endpoints would be several
times slower again. The API must be co-located with the database.

> **Why this hid for months:** a round trip on localhost costs ~0.1 ms. Forty sequential queries
> cost 4 ms locally and over 3 seconds against a hosted database. The fan-out was always there.
> The regression guard added in `attention.fanout.spec.ts` asserts *query count*, not timing — a
> timing test would pass on localhost no matter how bad the fan-out got, which is exactly how this
> survived.

---

## 4. Other work

- **Vehicle page rebuilt** around condition rather than cosmetics: hero photo, floating back
  control, detail sheet overlapping it, the score at 72 px in the band's own light-surface colour
  (5.6:1 at worst), three stats in a divided row, and a sticky "Book a service" — the page
  previously had **no primary action at all**. A dark-sheet version was built and rejected;
  the dark tokens added for it were removed rather than left unused.
- **Field sign-out** with a confirmation that names how many entries are still unsynced, and which
  clears local credentials even if the Firebase call fails — a shared tablet must not keep a
  session on thin signal.
- **Member back control** (`BackBar`). The navigator runs `headerShown: false`, so **27 of 29
  pushed screens have no visible way back**. Wired into the roadside screens; the rest is an open
  sweep.
- **Seeds:** `seed-plans.ts` (nothing created `Plan` rows, so roadside eligibility could never
  return true) and `seed-demo.ts` (a back-dated paid subscription + a DRIVER row). The demo seed
  **does not bypass BR-02** — it seeds history so the guard passes honestly.
- **Test accounts:** `test.admin` and `test.technician` were stuck at role `MEMBER` and could not
  sign into web or field. Promoted, and the trap documented in `README.md` — a correct password
  rejected with "This app is for AutoCare+ staff" reads like a credentials problem and is not.
- **Data model doc updated** — `announcements`/`announcement_reads`/`data_requests`/`system_config`/
  `operating_hours` were built but undocumented; `notifications` was documented but superseded.

---

## 5. State at the end

- `origin/main` = local `main` = `1959bb8`. Nothing unpushed.
- The API runs against Supabase on the **session pooler**. `apps/api/.env` is gitignored; a stray
  `.env.backup-*` holding the password was deleted and `.gitignore` hardened so a future copy
  cannot be committed.
- Member 313, field 174, web 106, contracts 47, design-tokens 47 — all green.

### Owed

- **Push notifications** — the thing the user actually asked for when they said "notification".
  Needs a spec: permission-prompt timing, copy, tap targets, token lifecycle, then a native rebuild.
- **`throttle.e2e-spec.ts`** expects 429 on the 6th auth call; `auth.controller.ts` allows 30/min.
  Two committed files disagreeing — a one-line fix either way.
- **`/me/attention` p95** still over 500 ms.
- **`BackBar` sweep** across the other 25 pushed member screens.
- **Field notification surface** — deliberately out of scope; the roadside board's 15 s poll covers
  dispatch only.
- **Rotate the Supabase password.** It is weak and was shared in chat.
- **Decide the test database.** The full API suite against Supabase takes ~20 min versus ~13 s
  locally. A separate test env file pointing at Docker is the usual split.
