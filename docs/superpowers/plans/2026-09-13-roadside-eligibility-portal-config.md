# Roadside Eligibility Portal Configuration Plan

**Goal:** Move roadside-assistance eligibility policy from a fixed code constant into an audited admin setting in the web portal, while preserving the current default: a member needs an active/GRACE subscription, a first successful payment, and a 30-day waiting period.

**Architecture:** Reuse the existing `SystemConfig` key/value table instead of creating a parallel settings system. A focused `RoadsideConfigService` validates and reads two configuration keys with safe code defaults; `RoadsideService.eligibility()` consumes that policy for every member. An admin-only API exposes the effective policy and an audited update mutation. A new `/admin/settings/roadside` screen lets administrators change the waiting period and whether a cleared first payment is required. The temporary email/environment bypass is removed once this configuration path is deployed.

**Tech Stack:** NestJS 10, Prisma/Postgres/Supabase, Zod contracts, Next.js App Router, existing API proxy, Jest, Vitest/Testing Library.

## Policy Model

| Setting | `SystemConfig` key | Type and bounds | Default | Effect |
| --- | --- | --- | --- | --- |
| Roadside waiting period | `roadside_waiting_days` | integer, 0–365 | `30` | Number of full days after the first successful payment before roadside unlocks. `0` means immediate eligibility after payment. |
| Require cleared payment | `roadside_require_cleared_payment` | boolean | `true` | When true, roadside needs at least one `SUCCEEDED` payment. When false, the wait is measured from subscription `startedAt`. |

The existing subscription-status rule remains unchanged: only `ACTIVE` and `GRACE` subscriptions are covered. The setting is global—changing it affects future eligibility checks for all accounts immediately; it does not write, backdate, or alter any invoice/payment record.

## Migration

Created:

- `apps/api/prisma/migrations/20260913130000_seed_roadside_eligibility_config/migration.sql`

The migration inserts the two defaults into `system_config` with `ON CONFLICT DO NOTHING`. It is intentionally a data migration only: `SystemConfig` already exists. This preserves any non-default value in a database where a key was manually added before deployment.

## API Contract

### `GET /roadside/admin/config`

Admin-only. Returns the effective policy, including safe fallbacks if the migration has not yet run:

```json
{
  "waitingDays": 30,
  "requireClearedPayment": true
}
```

### `PATCH /roadside/admin/config`

Admin-only. Requires both settings in every request to prevent partial, ambiguous policy changes:

```json
{
  "waitingDays": 0,
  "requireClearedPayment": true,
  "reason": "Launch promotion: waive roadside wait for new members"
}
```

Validation:

- `waitingDays`: integer from `0` through `365`.
- `requireClearedPayment`: boolean.
- `reason`: trimmed 5–300 characters; stored in audit history, never exposed to members.

The response returns the saved effective configuration. `PATCH` must set `Cache-Control: no-store` and be throttled (for example 10 writes/minute/admin).

## File Structure

**Created:**

- `apps/api/prisma/migrations/20260913130000_seed_roadside_eligibility_config/migration.sql`
- `apps/api/src/modules/roadside/roadside-config.service.ts`
- `apps/api/src/modules/roadside/roadside-config.service.spec.ts`
- `apps/web/app/admin/settings/roadside/page.tsx`
- `apps/web/app/admin/settings/roadside/page.test.tsx`
- `apps/web/lib/roadside/admin-config-api.ts`

**Modified:**

- `packages/contracts/src/roadside.ts`
- `packages/contracts/src/roadside.test.ts`
- `apps/api/src/modules/roadside/roadside.module.ts`
- `apps/api/src/modules/roadside/roadside.controller.ts`
- `apps/api/src/modules/roadside/roadside.service.ts`
- `apps/api/src/modules/roadside/roadside.service.spec.ts`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/admin/settings/roadside/page.test.tsx` (navigation and rendering coverage)
- local API development environment documentation/example

## Task 1: Apply and verify the configuration seed migration

- [ ] Review the migration against `SystemConfig`’s existing table name and primary key.
- [ ] Apply with the repository’s normal deploy command in staging:

```bash
pnpm --filter api prisma migrate deploy
```

- [ ] Verify both keys exist with values `30` and `true`.
- [ ] Re-run the deploy command to prove `ON CONFLICT DO NOTHING` is safe.
- [ ] Do not modify or delete existing `SystemConfig` records.

Acceptance: a fresh database gets both defaults; an existing database retains any manually-set value.

## Task 2: Add shared contracts

**Files:** `packages/contracts/src/roadside.ts`, `packages/contracts/src/roadside.test.ts`

- [ ] Add `roadsideEligibilityConfigSchema` for the GET response.
- [ ] Add `roadsideEligibilityConfigUpdateSchema` with `waitingDays`, `requireClearedPayment`, and `reason`.
- [ ] Export types from the contracts barrel.
- [ ] Test lower/upper bounds, non-integers, missing fields, invalid booleans, and short/long reasons.

Verification:

```bash
pnpm --filter @autocare/contracts test
pnpm --filter @autocare/contracts typecheck
```

## Task 3: Implement the config service and audit trail

**Files:** `apps/api/src/modules/roadside/roadside-config.service.ts`, `apps/api/src/modules/roadside/roadside-config.service.spec.ts`, `apps/api/src/modules/roadside/roadside.module.ts`

- [ ] Define constants for both setting keys and code defaults (`30`, `true`).
- [ ] Implement `get()` using two `findMany`/`findUnique` reads and strict parsing. Invalid/missing stored values must fall back to defaults rather than make roadside unavailable.
- [ ] Implement `set(actor, dto)` with an ADMIN-role guard.
- [ ] Upsert both keys in one Prisma transaction.
- [ ] Write one audit entry, for example `ROADSIDE_ELIGIBILITY_CONFIG_UPDATED:<reason>`, entity `SystemConfig`, entity ID `roadside_eligibility`; `before` and `after` contain both settings.
- [ ] Inject/export the service through `RoadsideModule` for use by `RoadsideService`.
- [ ] Unit-test fallback parsing, atomic two-key update, non-admin rejection, and audit payload.

## Task 4: Make eligibility consume the stored policy

**Files:** `apps/api/src/modules/roadside/roadside.service.ts`, `apps/api/src/modules/roadside/roadside.service.spec.ts`

- [ ] Inject `RoadsideConfigService`.
- [ ] Preserve the `ACTIVE`/`GRACE` subscription selection exactly as today.
- [ ] When `requireClearedPayment` is true, retain the first-successful-payment lookup; when false, use `subscription.startedAt` as the eligibility base date.
- [ ] Compute `eligibleFrom = baseDate + waitingDays × 24h` and permit eligibility on the boundary.
- [ ] Return clear member copy for all cases: no subscription, payment required but absent, and waiting-period date.
- [ ] Remove `ROADSIDE_WAITING_DAYS` as the production policy source; tests may use a default constant exported from the config service.
- [ ] Remove `ROADSIDE_TEST_BYPASS_EMAIL` and its test-only branch before release. The portal setting is a legitimate, auditable alternative; an email-specific environment override must not survive into deployed code.
- [ ] Test the matrix: defaults preserve current behavior, zero-day wait, payment-required off, missing payment with payment-required on, 30-day boundary, GRACE allowed, and SUSPENDED blocked.

## Task 5: Add protected configuration routes

**Files:** `apps/api/src/modules/roadside/roadside.controller.ts`

- [ ] Add static routes before `requests/:id`: `GET admin/config` and `PATCH admin/config`.
- [ ] Use `@CheckPolicy((a) => a.can("update", "User"))` or the existing ADMIN guard pattern, consistently with the staff-admin routes.
- [ ] Validate PATCH with the Zod pipe and add a tight `@Throttle` policy.
- [ ] Keep member routes unchanged; member eligibility responses never reveal admin reason/audit data.
- [ ] Add integration/e2e coverage for 401, 403, validation 400, successful read/update, and audit creation.

## Task 6: Build the admin portal page

**Files:** `apps/web/lib/roadside/admin-config-api.ts`, `apps/web/app/admin/settings/roadside/page.tsx`, tests, `apps/web/app/admin/page.tsx`

- [ ] Add a `Roadside settings` link to the admin dashboard.
- [ ] On load, render the effective policy with a short explanation of the operational consequences.
- [ ] Provide a numeric waiting-days field, payment-required switch, and mandatory reason field.
- [ ] Show a confirmation summary before saving, especially when reducing the wait to `0` or disabling payment requirement; state that the change takes effect immediately for all members.
- [ ] Prevent double submit; show save progress, success, and safe error states.
- [ ] Use the existing same-origin `/api/proxy` client; browser code must not access the database or service credentials.
- [ ] Test initial loading, validation, confirmation copy, successful save, error recovery, and whether zero-day/payment-off warnings render.

## Task 7: Release, verification, and operational cleanup

- [ ] Run migration in staging, then run API and web verification:

```bash
pnpm --filter @autocare/contracts test
pnpm --filter api test -- roadside
pnpm --filter api typecheck
pnpm --filter web test -- roadside
pnpm --filter web typecheck
```

- [ ] Manual staging test: set `waitingDays=0`, keep payment required, verify a paid active member becomes eligible immediately; then restore `30` and verify the displayed eligibility date changes.
- [ ] Confirm an unpaid member remains blocked when payment is required.
- [ ] Confirm each update produces exactly one audit event with before/after values and reason.
- [ ] Remove the local test bypass variables and deploy the code removal with this feature.
- [ ] Rollback procedure: restore both `SystemConfig` values to `30` / `true` through the portal or a targeted SQL update; the additive seed migration remains safe.

## Definition of Done

- Admins can view and change roadside waiting/payment policy in the portal without a code deployment.
- The current default behavior is unchanged after migration.
- Policy changes are validated, audited, admin-only, and take effect for new eligibility checks immediately.
- Payment/invoice history is never rewritten to alter roadside access.
- The temporary email-specific bypass is removed before release.
