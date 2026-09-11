# Backend & Database Deployment — Design

**Date:** 2026-09-11
**Status:** Draft for review — not yet implemented
**Scope:** Deploy the NestJS API and its datastores to the internet so the member/field apps and the staff web console can reach a real backend from a real device.

---

## Purpose

This deployment exists to be **demonstrated**. The audience is a thesis panel, not paying subscribers. That single fact sets every trade-off below:

- Cost target is **₱0/month**. Every component sits on a free tier.
- Uptime target is "reliably up when you press the button", not an SLA.
- Data is test data. No backup schedule, no PITR, no disaster-recovery runbook.
- Security still matters — real PII shapes and real auth flows are being shown — but the bar is "no credential is committed and no secret is guessable", not SOC 2.

Anything that only pays off for real users (monitoring, alerting, autoscaling, blue/green, custom domain, FCM) is explicitly **out of scope** and listed at the end.

---

## Topology

```
  Expo member app ─┐
  Expo field app ──┼──HTTPS──▶ Render Web Service  ──TCP──▶ Render Key Value (Redis)
  Next.js web    ──┘          "autocare-api"                  BullMQ queues, booking holds
                               NestJS, api/v1
                                    │
                        ┌───────────┴────────────┐
                        │                        │
                  Supabase Postgres        Supabase Storage
                  (jtqdzvgseziazhgyhdwh)   bucket "autocare"
                                                 │
                                           Firebase Auth
                                    (token verification only,
                                     project autocare-cbb6e)
```

Only two things are new: the Render **web service** and the Render **Key Value** instance. Postgres, Storage and Auth are accounts that already exist and already work — this deployment points at them rather than replacing them.

---

## Decisions

### D-1 — The API runs on Render's free web service

Chosen over Railway (~$5/mo, never sleeps), Cloud Run (free, but a Dockerfile plus `gcloud` auth) and Fly.io (card required). Render is free, deploys from a GitHub push, and needs no Docker knowledge.

**The cost of "free" is sleep.** A free Render service spins down after ~15 minutes of inactivity and takes roughly 50 seconds to answer the next request. Two consequences the demo has to live with:

1. **Wake the service before you present.** Open the health URL a minute before the panel starts. This is a manual step in the runbook, deliberately not automated with a cron pinger — those quietly burn the free allowance and some hosts treat them as abuse.
2. **Background jobs do not run while asleep** (see D-4).

### D-2 — Postgres stays on the existing Supabase project

`jtqdzvgseziazhgyhdwh` already serves Storage for the API's uploads, so keeping the database there means one vendor, one dashboard, one set of credentials. Render's own free Postgres was rejected because Render deletes free databases after 30 days — a trap across a thesis timeline.

**The password gets rotated as part of this work.** The current one is weak and was pasted into a chat transcript. Rotation is nearly free right now because the connection string has to be re-entered on Render anyway.

### D-3 — Redis is Render Key Value, and it is not persistent

BullMQ is not optional in this codebase: booking holds (`SET NX EX` + a Lua claim), the scheduling scheduler, invoice and certificate PDF generation, and the PayMongo webhook processor all need Redis. Render Key Value is free, lives on the same private network as the API, and adds no third vendor.

It has **no persistence**. On restart, queued jobs and any in-flight booking holds vanish. For a demo this is invisible — holds expire in 600 s anyway and the jobs are re-triggered by the next action. For real members it would not be acceptable, and this decision should be revisited before any real launch.

### D-4 — Scheduled jobs are accepted as unreliable, not worked around

The BullMQ processors run **in-process**, inside the API. A sleeping service runs no cron. So `flagNoShows` (05:00), `reminders.serviceDue` (08:00) and `capacity.utilisationAlarm` (06:00) will fire only if the service happens to be awake.

The honest options were: pay for an always-on instance, split the workers into a second service (doubles the deploy surface), or accept it. For a demo where those jobs are described rather than watched, **accept it** — and demonstrate their effects by triggering the underlying action directly instead of waiting for a cron. Flagged in "Known limitations".

### D-5 — Native Node build, no Dockerfile

Render's Node environment runs pnpm workspaces directly. A Dockerfile would be a second build system to maintain and debug for no gain at this scale. If the deploy later moves to Cloud Run or Fly, a Dockerfile becomes necessary — this decision is cheap to reverse.

The build must run **from the repo root**, because `apps/api` imports `@autocare/contracts` and `@autocare/scoring` as workspace packages that need compiling first. Turbo's `build` task already declares `dependsOn: ["^build"]`, so one root command covers the whole graph.

### D-6 — Migrations run in the build, not by hand

`prisma migrate deploy` runs as part of the build command, so a deploy that ships a schema change applies it in the same step. Render's dedicated pre-deploy hook is a paid feature; putting it in the build is the free equivalent.

The risk this accepts: a failed migration fails the deploy. That is the correct behaviour — better than a running API against a schema it does not expect.

---

## The Supabase connection is the part that will bite

This deserves its own section because it is the single most likely cause of a deploy that builds cleanly and then cannot reach the database.

Supabase offers two connection paths, and **the API and the migrations must use different ones**:

| Use | Connection | Port | Why |
|---|---|---|---|
| Runtime queries | Transaction pooler (Supavisor) | 6543 | Render gives each service a small connection budget; the pooler multiplexes. Also IPv4-reachable, which the direct host may not be. |
| `prisma migrate deploy` | Direct / session connection | 5432 | Migrations need a real session: advisory locks and DDL do not survive a transaction pooler. |

Concretely this needs:

- `DATABASE_URL` → pooler URI with `?pgbouncer=true&connection_limit=1`. Without `pgbouncer=true`, Prisma emits prepared statements the transaction pooler cannot handle, and queries fail intermittently under load with `prepared statement "s0" already exists` — an error that looks like a code bug and is not.
- `DIRECT_DATABASE_URL` → the direct URI, used only by migrations.
- A **schema change**: `datasource db` currently declares `url` and `shadowDatabaseUrl`. It needs `directUrl = env("DIRECT_DATABASE_URL")` added. `shadowDatabaseUrl` stays as-is — it is only read by `migrate dev`, which never runs in production.

`SHADOW_DATABASE_URL` must **not** be set on Render. It exists for local `migrate dev` only, and the env schema does not require it.

---

## Environment variables

`apps/api/src/config/env.ts` validates these with Zod at boot, so a missing or malformed value fails fast and loudly rather than at first request. Every one of them must exist on Render.

| Variable | Source | Secret | Note |
|---|---|---|---|
| `DATABASE_URL` | Supabase → pooler URI | yes | Port 6543, `?pgbouncer=true&connection_limit=1` |
| `DIRECT_DATABASE_URL` | Supabase → direct URI | yes | Port 5432, migrations only — **new variable** |
| `REDIS_URL` | Render Key Value internal URL | yes | Internal, not external — stays on the private network |
| `FIREBASE_PROJECT_ID` | `autocare-cbb6e` | no | |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account | no | |
| `FIREBASE_PRIVATE_KEY` | Firebase service account | yes | **See the newline note below** |
| `SUPABASE_URL` | `https://jtqdzvgseziazhgyhdwh.supabase.co` | no | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API settings | yes | Server-only; never reaches a client |
| `SUPABASE_STORAGE_BUCKET` | `autocare` | no | |
| `API_PORT` | `10000` | no | Render's expected port |
| `POLICY_VERSION` | `2026-08-privacy-v1` | no | Must match the member app's `EXPO_PUBLIC_POLICY_VERSION` or every consented user is asked to re-consent |
| `SESSION_SECRET` | freshly generated, 32+ chars | yes | Must be byte-identical in `apps/web` or staff login breaks |
| `MAPBOX_TOKEN` | `autocare-api-directions` token | yes | FR-039 route distance |
| `WORKSHOP_LAT` / `WORKSHOP_LNG` | `6.9214` / `122.0790` | no | Origin for that distance |
| `PAYMONGO_SECRET_KEY` | PayMongo **test** key | yes | Optional in the schema; the real adapter throws at call time if a payment is attempted without it |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo test webhook | yes | Optional |
| `NODE_VERSION` | `20` | no | `engines` pins `>=20 <21`; Render defaults higher |

**The `FIREBASE_PRIVATE_KEY` newline trap.** The key is a PEM block whose `\n` sequences survive `.env` files as literal backslash-n. Pasted into Render's dashboard, they may stay literal, and `firebase-admin` then fails to parse the key with an error that does not name the cause. The fix is either to paste the key with real newlines, or to `.replace(/\\n/g, "\n")` where it is read. Whichever is chosen must be verified by an actual token verification against the deployed service, not assumed.

---

## CORS

`main.ts` never calls `app.enableCors()`. Today that is invisible: the Expo apps are native and not subject to CORS, and the Next.js staff console talks to the API through its own server-side BFF proxy (`app/api/proxy/[...path]`), which is also exempt.

So **no CORS change is needed for this deployment** — but the moment anything calls the API from browser JavaScript on another origin, it will fail with an error that blames the browser rather than the server. Noted here so the next person does not spend an afternoon on it.

---

## Seed data

A freshly deployed database has 22 migrations applied and **no rows**. A demo needs at minimum:

- `prisma/seed-checklist.ts` — the 43-point inspection checklist. Without it, the field app's submissions are rejected with `CHECKLIST_INVALID`.
- `prisma/seed-scheduling.ts` — service types, bays, shifts. Without it, no bookable slots exist, and the attention dashboard shows no `SERVICE_DUE` items.
- `prisma/seed-parts.ts` — parts catalogue for work orders.

**There is no plan seed, and that is a gap.** No `Plan` rows means no subscriptions, which means the subscription screens are empty and roadside eligibility can never return `eligible: true` — the BR-02 guard refuses at the first check. A `prisma/seed-plans.ts` needs writing as part of this work: a small set of plans with their `PlanEntitlement` rows, including `ROADSIDE`.

Seeds run **once, manually**, from a local machine pointed at the deployed database. Wiring them into the build would re-seed on every deploy.

---

## Verification

The deploy is not done when it is green. It is done when this passes against the live URL:

1. `GET /api/v1/health` → 200. Proves the process boots, which means every Zod-validated env var parsed.
2. `GET /api/v1/roadside/eligibility` without a token → 401 `AUTH_TOKEN_INVALID`. Proves the guard chain is wired, not just the router.
3. A seeded member's full roadside lifecycle — eligibility → create → dispatch → status → resolve — against the deployed API, the same script shape used locally on 2026-09-11. Proves Postgres writes, the auth guard, and the outbound Mapbox call all work from Render's network.
4. A file upload through the signed-URL path. Proves the Supabase service-role key is right — the one credential no other check exercises.
5. A booking hold. Proves Redis is actually connected rather than silently failing.
6. A real Firebase ID token from the member app exchanged for a session. Proves the private-key newline handling.

Checks 4 and 6 have never run against real infrastructure in any session so far — they are the two most likely to fail first.

---

## Rollback

Render keeps previous deploys and can redeploy any of them from the dashboard in about a minute. That covers application rollback.

**Migrations do not roll back.** Prisma has no down-migrations here, and a redeploy of older code against a newer schema is only safe if the change was additive. Every roadside migration so far has been additive (new tables, new nullable column), so this is currently fine — but it means a destructive migration would need a deliberate plan, not a dashboard button.

---

## Known limitations

| Limitation | Consequence | Would need |
|---|---|---|
| Free service sleeps (D-1) | ~50 s first request after idle | Paid instance |
| Cron jobs unreliable (D-4) | No-show flagging and reminders fire only when awake | Always-on instance, or a separate worker service |
| Redis not persistent (D-3) | Queued jobs and holds lost on restart | Upstash or Redis Cloud |
| No backups | A dropped table is gone | Supabase paid tier (PITR) |
| No monitoring | Failures are discovered by using the app | Sentry / Better Stack free tiers |
| Single region | Render free is US-based; PH latency ~250 ms | Paid region choice, or Fly Singapore |

---

## Out of scope

The member/field Expo apps (they are built and distributed, not deployed), the Next.js staff console deployment, a custom domain, FCM push (D-4 of the roadside plan), CI-driven auto-deploy gating on tests, and any observability stack. Each is its own piece of work.

---

## Open questions for review

1. **PayMongo keys** — include test keys so the billing flow is demonstrable, or leave unset and skip billing in the demo? Leaving them unset is safer but makes any payment attempt throw.
2. **Seed breadth** — a minimal seed (one plan, one vehicle, one member), or a fuller fixture with inspection history and a health score, so the VHS screens have something to show?
3. **Region** — accept Render's US free region and its ~250 ms latency from Zamboanga, or is latency visible enough during a live demo to justify paying for Singapore?
