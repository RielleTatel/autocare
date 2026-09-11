# AutoCare+

Monorepo managed with pnpm workspaces + Turborepo.

## Apps

| App | Path | Stack | Runs on |
|---|---|---|---|
| `api` | `apps/api` | NestJS | `3001` |
| `web` | `apps/web` | Next.js | `3000` |
| `member` | `apps/member` | Expo (mobile) | Metro `8081` |
| `field` | `apps/field` | Expo (mobile) | Metro `8082` (or `8081` when run alone) |

Shared packages live in `packages/` — `contracts` (API types + Zod schemas), `scoring` (the Vehicle Health Score engine and checklist config), `design-tokens`, `api-client`, `config`.

## Prerequisites

- Node 20.x (`engines` pins `>=20 <21`)
- pnpm 9
- Docker — for the local Postgres used as Prisma's migration shadow database
- An `apps/api/.env`, `apps/member/.env`, `apps/field/.env` (all gitignored; copy from `.env.example`)

## Setup

```bash
pnpm install
docker compose up -d --pull never   # local Postgres (5432) + Redis (6379)
```

`--pull never` avoids a Docker credential-helper prompt when the images are already cached.

> Redis may fail to start if you already have one on `6379`. That's harmless — the existing instance serves the API.

## Ports

| Service | Address |
|---|---|
| `api` | `http://localhost:3001/api/v1` |
| `web` | `http://localhost:3000` |
| `member` Metro | `http://localhost:8081` |
| `field` Metro | `http://localhost:8082` |
| Postgres (shadow DB) | `localhost:5432` |
| Redis | `localhost:6379` |
| Prisma Studio | `http://localhost:5555` (`npx prisma studio` in `apps/api`) |

`web` has no page at `/` — real routes are `/login`, `/staff`, `/admin`.

## Running

```bash
pnpm serve:all       # api + web + member + field
pnpm serve:web       # api + web
pnpm serve:member    # api + member
pnpm serve:field     # api + field
pnpm serve:mobile    # api + member + field
```

### ⚠️ The `serve:*` scripts suppress Expo's QR code

`concurrently` pipes each process's output to add the `[member]` / `[field]` prefixes, so Metro no longer sees a TTY and hides its interactive UI — **no QR code and no keyboard shortcuts** (`a`, `r`, `j`).

To get the QR, run each Expo app in its own terminal:

```bash
pnpm --filter member start                 # QR, port 8081
pnpm --filter field start -- --port 8082   # QR, port 8082
```

Use `serve:*` for the API and web, where there's no interactive UI to lose.

## Mobile development builds

Both mobile apps need **custom dev clients** — not Expo Go — because they depend on native modules Expo Go doesn't ship.

| App | Why a dev client | Deep-link scheme |
|---|---|---|
| `member` | `@react-native-firebase/*` | `autocare` |
| `field` | `expo-sqlite`, `expo-secure-store`, `expo-camera` | **none set** |

Rebuild with EAS **only when native code changes** — adding/removing/upgrading a native module, editing `app.json` / `app.config.js`, or bumping the Expo SDK. Day-to-day JS/TS work hot-reloads through Metro.

```bash
cd apps/member && npx eas-cli build --profile development --platform android --non-interactive
cd apps/field  && npx eas-cli build --profile development --platform android --non-interactive
```

### Connecting a device

1. Both devices must be on the **same network**.
2. Find your machine's LAN IP: `ipconfig getifaddr en0`
3. Put that IP in `EXPO_PUBLIC_API_URL` in `apps/member/.env` and `apps/field/.env`, then **restart Metro** — `EXPO_PUBLIC_*` values are baked in at bundle time and won't hot-reload.
4. In the dev client's *Enter URL manually*, type `http://<your-ip>:8081` (member) or `http://<your-ip>:8082` (field).

Because `field` has no `scheme`, its QR can't be opened from the phone's camera — open the field dev client first and scan from **inside** it. `member` deep-links fine from the camera.

## Test accounts

> **Dev only.** These exist on the `autocare-cbb6e` Firebase project against the development database. Never create them in production, and keep this repository private.

| Role                    | Email                          | Password       | Use in   |
| ----------------------- | ------------------------------ | -------------- | -------- |
| Member                  | `test.member@autocare.dev`     | `TestPass123!` | `member` |
| Technician (`MECHANIC`) | `test.technician@autocare.dev` | `TestPass123!` | `field`  |
| Admin (`ADMIN`)         | `test.admin@autocare.dev`      | `TestPass123!` | `web`    |
| Driver (`DRIVER`)       | `seed.driver@autocare.dev`     | `TestPass123!` | `field`  |

The member account has privacy-policy consent recorded. Without it, every protected endpoint returns `CONSENT_REQUIRED`; staff are exempt (they consent through employment, not a checkbox).

> The `test.*` accounts sign up as `MEMBER` like anyone else — `test.admin` and `test.technician` had to be promoted in the database before they could sign into `web` and `field`. If a documented account is rejected with "This app is for AutoCare+ staff", check `User.role` before suspecting the password.
>
> `test.driver@autocare.dev` also exists as a `DRIVER` **row** so the roadside dispatch picker has somebody to assign, but it has no Firebase account and cannot be signed into. Use `seed.driver` above to log in as a driver. Without it, every protected endpoint returns `CONSENT_REQUIRED`.

**Creating more accounts:** Firebase authenticates identity; roles live in the `User.role` column. Sign-up always creates a `MEMBER` — there is no self-serve path to a staff role. To promote someone, sign in once so the API creates their row, then change `role` in Prisma Studio to `MECHANIC`, `ADVISOR`, `FLEET_MANAGER`, `DRIVER`, or `ADMIN`.

## Database

Migrations target the remote Supabase database in `DATABASE_URL`, using the local Docker Postgres as Prisma's shadow database — so Docker must be running.

```bash
cd apps/api
npx prisma migrate status                    # read-only check
npx prisma migrate dev --name <description>  # create + apply
npx prisma studio                            # browse data
```

Checklist and parts seeds are idempotent and **short-circuit when the version already exists** — editing `seed-config.ts` will not update an already-seeded checklist. Changing an existing published version's fields requires a deliberate backfill.

## Other commands

```bash
pnpm build       # turbo run build
pnpm test        # turbo run test
pnpm typecheck   # turbo run typecheck
pnpm lint        # turbo run lint
```

Per package: `pnpm --filter <name> test`. Packages use vitest; apps use jest.

## Troubleshooting

**"Host unreachable" from the phone.** Public and café Wi-Fi usually enable AP/client isolation, which blocks device-to-device traffic entirely. Nothing on your machine can fix it — use a phone hotspot and connect the Mac to it. *Unreachable* means the packets never arrive; *connection refused* would mean the host was found but the port was closed.

**"Cannot reach the server" inside the app.** `EXPO_PUBLIC_API_URL` is stale. Your LAN IP changes whenever you switch networks. Update both `.env` files and restart Metro.

**Port already in use.**
```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN   # swap the port as needed
kill <PID>
```

**`EADDRINUSE :::8081`.** Both Expo apps default to 8081. Start `field` with `-- --port 8082`.

**`Cannot find native module '…'`.** The JS bundle expects a native module the installed dev client doesn't contain — either you scanned one app's URL with the other app's dev client, or the dev client predates a dependency change. Check which Metro you're connected to first; rebuild only if that isn't it.

**API tests fail together but pass alone.** The e2e suites share the remote database and interfere. Run a single suite to get a trustworthy signal: `pnpm --filter api test -- <path>`.
