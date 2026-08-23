# Checkpoint — SecureStore Crash Fix & Supabase DB Migration (2026-08-23)

Context: user tried to launch `apps/member` on a physical Android device via
a custom EAS dev-client build and hit a native crash on every boot. Chasing
that down surfaced a broader architecture-clarity gap (what's Firebase vs.
Supabase vs. Postgres actually doing), which led into deliberately migrating
the app's database off local Docker and onto hosted Supabase Postgres ahead
of eventual deployment.

---

## 1. `NoClassDefFoundError: AnyTypeProvider` crash on every launch

**Symptom:**
```
java.lang.NoClassDefFoundError: Failed resolution of: Lexpo/modules/kotlin/types/AnyTypeProvider;
    at expo.modules.securestore.SecureStoreModule.definition(SecureStoreModule.kt:408)
    ...
Caused by: java.lang.ClassNotFoundException: Didn't find class "expo.modules.kotlin.types.AnyTypeProvider"
```
Crashed immediately on app start, before any JS ran — this is native module
registration failing during `ReactInstance` init.

**Investigation (systematic-debugging, three hypotheses tested in order):**

1. **Hypothesis: stale dev-client build.** The installed APK predated recent
   `app.json`/bundle-id changes (`com.mao.autocare`), so maybe it just needed
   a rebuild. Triggered a fresh `eas build --profile development`. **Result:
   crash persisted with a new APK.** Hypothesis rejected — but confirmed the
   general dev-client workflow (uninstall old app, install new APK, `expo
   start --dev-client`) works.

2. **Hypothesis: R8/ProGuard stripping the class.** Downloaded the built APK
   and inspected its `.dex` files directly with `androguard` (no Android
   Studio available — user explicitly didn't want to install it). Found
   `AnyTypeProvider` referenced as a *type* in `classes8.dex` but never
   *defined* as a class anywhere in the APK — the classic signature of R8
   shrinking stripping a reflection-only-reachable class. Added
   `expo-build-properties` → `android.enableProguardInReleaseBuilds: false`
   in `apps/member/app.json`, rebuilt. **Result: class still missing.**
   Hypothesis rejected.

3. **Root cause, confirmed:** Cross-referenced the crash's cited line number
   (`SecureStoreModule.kt:408`) against the actual file in
   `node_modules/expo-secure-store` — only **389 lines**. That's impossible
   for the *current* file to produce (Kotlin inline-function debug info can
   push line numbers past the raw file for inlined DSL builders, which
   explains the gap, but the deeper problem was underneath): grepping the
   entire resolved dependency tree found **zero source references** to
   `AnyTypeProvider` anywhere in `expo-modules-core@57.0.11` — it doesn't
   exist in that version at all. `expo-secure-store` was pinned at
   `~15.0.7` — the **old pre-SDK-aligned versioning scheme**. `npx expo
   install --check` confirmed: SDK 57 expects `expo-secure-store@~57.0.1`,
   not the `15.x` line. Installing a `15.x` module against a `57.x`
   `expo-modules-core` is a genuine ABI break, not a build artifact.

**Fix:**
- `npx expo install expo-secure-store` → bumped to `~57.0.1` in
  `apps/member/package.json`.
- Added the `"expo-secure-store"` config plugin entry to
  `apps/member/app.json` (Expo couldn't auto-write it into the dynamic
  `app.config.js`).
- Reverted the `enableProguardInReleaseBuilds: false` change from the
  rejected hypothesis #2 — not needed, would have just been unrelated noise.

**Verified:** Rebuilt via EAS, downloaded the new APK, confirmed with
`androguard` that `AnyTypeProvider` is no longer referenced *anywhere* in
any `.dex` file (nothing needs it once the correct module version is used).
User confirmed the app launches and stays up.

**Method note for next time:** don't trust "the class exists" from a plain
`strings`/grep hit on a `.dex` file — that only proves the type is
*referenced*, not *defined*. Use a real dex parser (`androguard`'s
`DEX().get_classes()`) to check `class_def_item`s directly, or you'll get
false negatives on real bugs (this happened once during the investigation).

---

## 2. Architecture confusion cleared up: Firebase vs. Supabase vs. Postgres

User (reasonably) assumed Firebase = the database, since it was the first
thing configured and `google-services.json`/`GoogleService-Info.plist` are
prominent. Actual split, confirmed by reading the code, not assuming:

| Concern | Service | Evidence |
|---|---|---|
| Auth identity (sign-in, token verification) | **Firebase** (Admin SDK server-side, `firebase-admin`) | `apps/api/src/modules/auth/firebase.service.ts`, `auth.guard.ts` — verifies ID tokens only |
| App data (users, vehicles, subscriptions, invoices, everything) | **Postgres** via Prisma | `apps/api/prisma/schema.prisma` — `User.firebaseUid` is the *only* link back to Firebase; a unique FK, not a data store |
| File storage (vehicle photos, PDF receipts) | **Supabase Storage** | `apps/api/src/common/storage/supabase-storage.adapter.ts` — private bucket, signed URLs |

Key clarifications delivered:
- No Firestore is used or needed — Firebase Auth has no "schema" of its own,
  it only issues `{uid, email, provider}` tokens.
- Supabase was **only** wired for Storage as of commit `f84293d` (2026-08-21,
  *"refactor: Supabase Storage + member email/password auth"*) — replaced
  `FirebaseStorageAdapter`. It was **not** used for the database until this
  session (§3 below).
- Firebase project (`autocare-cbb6e`) is consistent across the API's admin
  credentials and both mobile app config files — verified by direct
  comparison, not assumed.
- No pre-seeded test accounts exist anywhere (`apps/api/prisma` has no seed
  script) — testing requires signing up fresh through `EmailAuthScreen`.

---

## 3. Migrated the database from local Docker Postgres to Supabase Postgres

**Motivation:** user is planning to actually deploy this, and pointed out
(correctly) that since a Supabase project already exists for Storage, that
project *already has a Postgres database provisioned* — using it avoids
introducing a third hosting vendor.

**What was done:**
1. User supplied the direct connection host/port/user
   (`db.jtqdzvgseziazhgyhdwh.supabase.co:5432`, user `postgres`) and a
   password over chat.
2. Verified connectivity with `psql` before touching any config.
3. Confirmed the target database was empty (`\dt public.*` → no relations)
   — safe to apply migrations fresh, nothing to lose.
4. Updated `apps/api/.env` → `DATABASE_URL` now points at Supabase instead
   of `localhost:5432` (Docker). Local Docker Postgres (`autocare-postgres-1`)
   was left running, untouched, as a fallback — not stopped.
5. Ran `npx prisma migrate deploy` from `apps/api` — all 8 existing
   migrations applied cleanly.
6. Verified via `psql \dt` — all 18 expected tables present
   (`users`, `vehicles`, `subscriptions`, `invoices`, `plans`,
   `organizations`, `audit_log`, etc.).

**Not changed / explicitly out of scope this session:**
- **CI is unaffected** — `.github/workflows/ci.yml` spins up its own
  ephemeral `postgres:15-alpine` service container per run with a stub
  `DATABASE_URL`/`SUPABASE_URL`; nothing here touches that.
- **Redis is still local-only** (Docker `autocare-redis-1`) — not migrated
  to a hosted option (e.g. Upstash) yet.
- Used the **direct** connection string (port 5432), not the pooled/PgBouncer
  one (port 6543). Reasonable for now since the API is a single long-running
  process, not serverless — but worth revisiting if the API ever scales to
  multiple instances, since direct connections have a low concurrent-connection
  ceiling on Supabase's free tier.

---

## Net result

| Component | State after this checkpoint |
|---|---|
| `apps/member` SecureStore crash | Fixed and verified — root cause was `expo-secure-store@15.0.7` vs `expo-modules-core@57.x` ABI mismatch, not a build/proguard issue |
| Database | Now Supabase-hosted Postgres (`jtqdzvgseziazhgyhdwh` project), all migrations applied, 18 tables confirmed live |
| Local Docker Postgres | Still running, now an unused fallback — safe to stop later, data not kept in sync with Supabase going forward |
| Redis | Still local Docker only — no hosted equivalent yet |
| Firebase | Confirmed correctly configured (Auth only) — no changes made this session |
| Supabase Storage | Unchanged — same project, already working |
| CI | Unaffected — uses its own ephemeral Postgres container |

## Things to consider moving forward

- **Rotate the Supabase database password immediately.** It was set to a
  weak, guessable value (redacted) and was also pasted in plaintext
  into this chat session — treat it as compromised. Supabase dashboard →
  Project Settings → Database → Reset database password, then update
  `apps/api/.env`.
- **Redis still needs a hosted home before deploy** — Upstash's free tier
  is the natural fit (works with `ioredis`/BullMQ). Not done yet.
- **Decide on pooled vs. direct connection** before deploying the API
  anywhere that might run multiple instances — Supabase's transaction
  pooler (port 6543) is the safer default for a deployed backend; direct
  (port 5432) is fine for a single local/dev process.
- **`expo-doctor` has two outstanding, non-urgent warnings** (confirmed
  unrelated to the crash fix, left alone per user's call):
  - Duplicate `expo-constants` versions (57.0.13 via `expo-linking` vs.
    57.0.12 via `expo` itself) — same *category* of risk as the bug just
    fixed (native module version skew), worth deduplicating before it causes
    a real problem, even though it isn't one yet.
  - `expo` (57.0.14→~57.0.15), `react-native-safe-area-context`,
    `react-native-screens` behind by minor/patch versions; `typescript`
    behind by a **major** version (5.9.3→~6.0.3, flagged as higher-risk,
    needs its own validation pass, not a drop-in bump).
- **No seed data / test accounts exist anywhere** — every environment
  (local Docker, now Supabase too) starts from zero users. If QA or demo
  flows need repeatable test accounts, a seed script doesn't exist yet and
  would need to be written.
- **Phase 3 (Scheduling) plan is still a draft** — core capacity-engine
  signature is settled in
  `docs/superpowers/plans/2026-08-08-phase-3-scheduling.md`, but per the
  project's own sequencing rule it needs to be expanded to full step-level
  detail before implementation starts (same treatment Phase 1 and Phase 4
  already got). Not started.
- **Free-tier deployment plan is still just a sketch**, not committed to:
  Supabase (Postgres + Storage, already in progress) + Vercel (web) +
  Fly.io/Render (API) + Upstash (Redis) was the direction discussed. The
  main known friction point: BullMQ's billing/DPA background jobs need an
  **always-on** worker process, and most free web-service tiers (Render's
  free tier especially) spin down on inactivity, which would silently break
  scheduled jobs. Needs a real decision before deploying, not just dev-DB
  migration.
- **General secrets hygiene:** multiple real credentials (Supabase DB
  password, Supabase API keys) were pasted directly into this chat session
  during the migration. They're now in `apps/api/.env` (gitignored, not
  committed) — but as a habit going forward, consider passing secrets via
  a password manager reference or `1Password CLI`/similar instead of raw
  chat text, especially once this project has real user data in it.
