# Checkpoint — Local Dev Environment Fixes (2026-08-22)

Context: after Phase 2 (Subscription & Billing) merged to `main`, the user
tried to actually run the app locally for the first time — via
`docker compose up -d` per the Phase 0 spec — and hit a chain of environment
problems. This doc records each one, the root cause, and the fix, so it
doesn't have to be re-diagnosed later.

---

## 1. `docker: command not found`

**Symptom:** `docker compose up -d` failed with `zsh: command not found: docker`.

**Root cause:** Docker.app *was* installed (`/Applications/Docker.app`), but
`/usr/local/bin/docker` was a symlink pointing at
`/Users/tatelgabrielle/Desktop/Docker.app/Contents/Resources/bin/docker` — a
path that no longer existed. At some point Docker.app was moved from
`~/Desktop` into `/Applications`, and the symlink was never updated. This
predates any work done this session; earlier sessions had simply worked
around it by using native Homebrew Postgres/Redis instead of Docker (see
Phase 0 checkpoint notes) rather than fixing the symlink.

**Fix:**
```bash
sudo rm /usr/local/bin/docker
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker /usr/local/bin/docker
```

## 2. `docker-credential-desktop: executable file not found in $PATH`

**Symptom:** After fixing (1), `docker compose up -d` started pulling images
but failed with:
```
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in $PATH
```

**Root cause:** Same stale-symlink problem, different binary —
`/usr/local/bin/docker-credential-desktop` also pointed at the old
`~/Desktop/Docker.app` path.

**Fix:**
```bash
sudo rm /usr/local/bin/docker-credential-desktop
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker-credential-desktop /usr/local/bin/docker-credential-desktop
```

## 3. Credential helper still failing (exit status 1) even after the symlink fix

**Symptom:** With the symlink correct, `docker compose up -d` still failed:
```
error getting credentials - err: exit status 1, out: ``
```

**Root cause:** `~/.docker/config.json` had `"credsStore": "desktop"`, so the
Docker CLI invokes `docker-credential-desktop` to check for stored registry
credentials on *every* pull — including anonymous pulls of public images
(`postgres:15-alpine`, `redis:7-alpine`) where no credentials are needed at
all. The helper itself was failing for unrelated reasons (likely needs
Docker Desktop's full backend/keychain integration that wasn't fully
initialized), and its failure blocked the pull even though nothing it
returns is actually required here.

**Fix:** Removed `credsStore` from `~/.docker/config.json` (backed up first
as `config.json.bak`) so the CLI doesn't invoke the helper for anonymous
pulls:
```bash
cp ~/.docker/config.json ~/.docker/config.json.bak
python3 -c "
import json
p = '/Users/tatelgabrielle/.docker/config.json'
d = json.load(open(p))
d.pop('credsStore', None)
json.dump(d, open(p,'w'), indent=2)
"
```

## 4. Port conflict: native Postgres/Redis already bound to 5432/6379

**Symptom:** Even with Docker itself fixed, `docker compose up -d` would
have failed to bind ports 5432/6379 because native (Homebrew-installed but
manually started, not `brew services`-managed) Postgres and Redis processes
already held them.

**Root cause:** Earlier phases (Phase 0 onward) used native Homebrew
Postgres 14 + Redis as a workaround for the broken Docker CLI, per an
explicit environment note in project memory: *"no Docker CLI here — used
native Homebrew Postgres/Redis."* Those processes were still running.

**Fix:** Stopped the native processes (they weren't under `brew services`,
so `brew services stop` reported nothing to do — had to `kill` the PIDs
directly found via `lsof -nP -iTCP:5432 -sTCP:LISTEN` /
`-iTCP:6379`). Native data on disk was left untouched — stopping the
processes doesn't delete anything, it just frees the ports.

**Trade-off flagged to the user before doing this:** the Docker Postgres
container starts with an **empty** database. Existing local dev data on the
native Postgres cluster is not migrated over automatically; it's still on
disk if the native services are restarted later, but the two databases are
not kept in sync — only one can be live on port 5432 at a time. User
explicitly approved this before it happened.

## 5. Docker fully working — but then the API failed to boot as a real process

**Symptom:** After `docker compose up -d` succeeded (`autocare-postgres-1`
healthy, `autocare-redis-1` running) and `prisma migrate deploy` applied all
8 migrations cleanly to the fresh Docker DB, running the API for real
(`nest start --watch`, then `node dist/main.js`) crashed immediately:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'.../packages/contracts/src/errors' imported from
'.../packages/contracts/src/index.ts'
```

**This is unrelated to Docker** — Docker was fully fixed by this point. It
turned out to be a separate, pre-existing bug.

**Root cause:** `packages/contracts`, `packages/api-client`, and
`packages/design-tokens` all pointed their `package.json` `"main"` field
directly at raw TypeScript source (`src/index.ts`), with **no build step**
at all. Their shared `tsconfig.base.json` uses `module: "NodeNext"`, so
internal imports are extensionless (`export * from "./errors"` — valid
under `NodeNext` typechecking, but not valid for a plain Node.js runtime
resolving `.ts` files). This had always "worked" for Jest and Vitest
because those test runners use their own TypeScript-aware module resolvers
that don't enforce Node's native ESM extension rules. It never worked for
actually running the compiled app as a standalone process — which,
critically, **appears to have never actually been done before**. Every
prior "the API boots and serves `GET /api/v1/health`" verification across
Phases 0–2 almost certainly went through in-process Jest/Supertest tests,
which don't exercise this code path at all.

Confirmed this was a Node-version-independent bug (not the `node v24` vs
project's targeted `node 20` mismatch) by reproducing the identical failure
on a freshly-installed Node 20.20.2 via `nvm`.

**Fix:** Gave the three packages a real build step:
- Added `tsconfig.build.json` to each (`module: "commonjs"`, `outDir: "dist"`,
  excludes `*.test.ts`) — CommonJS output matches how `apps/api` itself
  compiles, so plain `require()` resolves the compiled `.js` output the
  classic tolerant CJS way (no extension issues).
- Added a `"build": "tsc -p tsconfig.build.json"` script to each package.
- Changed `"main"`/`"types"` in each `package.json` from `src/index.ts` to
  `dist/index.js` / `dist/index.d.ts`.
- No changes needed to `turbo.json` — its existing
  `"build": { "dependsOn": ["^build"] }` pipeline picked up the new build
  scripts automatically for every app that depends on these packages.

**Verified:** full `pnpm turbo run typecheck test` stayed green (17/17
tasks, up from 14 — the 3 new build tasks), and the API booted as a real
standalone process for the first time — every module loaded (Plans,
Subscriptions, Payments, Cash, Invoices, Billing scheduler, etc.), every
route mapped, and `GET /api/v1/health` and `GET /api/v1/plans` both
round-tripped successfully against the live Docker Postgres.

Commit: `83b323d` — *fix: build shared packages to CommonJS dist instead of
shipping raw .ts as main*, pushed to `origin/main`.

## 6. Minor: stray `EADDRINUSE` on final boot

**Symptom:** The very first successful boot (with the dist fix in place)
crashed right after fully starting, with `Error: listen EADDRINUSE: address
already in use :::3001`.

**Root cause:** A stale process from an earlier failed attempt (during the
Node-version debugging in problem 5) was still bound to port 3001.

**Fix:** `lsof -nP -iTCP:3001 -sTCP:LISTEN -t | xargs kill -9`, then
restarted cleanly. Not a real bug — just leftover process cleanup.

## 7. Along the way: two Firebase credential gaps closed

Not a "problem encountered while running the app" so much as prerequisites
verified/fixed while investigating why `apps/member` and `apps/field`
couldn't authenticate:

- `apps/member/google-services.json` (Android Firebase config) was missing
  entirely — added it (user supplied the file; verified it matches the
  same Firebase project (`autocare-cbb6e`) and bundle ID (`com.mao.autocare`)
  as the existing iOS `GoogleService-Info.plist`).
- `apps/member/.gitignore` ignored `GoogleService-Info.plist` (the iOS
  secret) but was missing `google-services.json` (the Android secret) —
  fixed so the Android credential file can never be accidentally committed.
  Commit: `ae95f2a`.

## 8. Cleanup: a secret-bearing backup file

While inspecting the working tree during the Phase 2 merge, found
`apps/api/.env.bak.1787310902` — an untracked, **not gitignored** copy of
`.env` containing a live `DATABASE_URL`. Deleted it (the real `apps/api/.env`
was untouched and confirmed intact first). Origin unclear — likely a stray
artifact from an earlier tool/session, not something intentionally created.

---

## Net result

| Component | State after this checkpoint |
|---|---|
| Docker | Fully working — `docker compose up -d` brings up spec-compliant Postgres 15 + Redis 7 |
| API | Boots as a real standalone process (`pnpm --filter api run start`), all Phase 0–2 routes live, verified against the real Docker DB |
| Shared packages (`contracts`, `api-client`, `design-tokens`) | Now have real CommonJS builds; consumable by Node at runtime, not just by test runners |
| `apps/member` | iOS + Android Firebase credentials both present; needs a dev build (native modules) to actually run, not Expo Go |
| `apps/field` | Real Firebase JS SDK credentials present; can run in Expo Go |
| `apps/web` | Only the login shell exists; no billing/counter-collection UI yet (W-13/W-14 still owed from Phase 2) |

## Still open / owed

- Real PayMongo webhook signature format + live-sandbox smoke test
- iOS-sim verification of the `autocare://payment-result` deep link
- W-13/W-14 web staff pages (counter collection + shift close)
- The Docker Postgres DB is currently empty — no seed data yet
