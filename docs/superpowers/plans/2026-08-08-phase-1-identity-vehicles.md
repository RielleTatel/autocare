# Phase 1 — Identity & Vehicles Implementation Plan (DRAFT)

> **Status: DRAFT** — written ahead of phase start. Task list, interfaces, and data model are settled; expand each task into bite-sized TDD steps (superpowers:writing-plans format) at phase start, once Phase 0's actual code exists to anchor exact paths and signatures.
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** A member can register with phone OTP or Google, accept the DPA consent, manage their profile, and put vehicles on file with validated plates and photos — end-to-end on iOS + API; staff can sign in on web.

**Covers:** M1 (FR-001→FR-015). Screens M-01→M-07, M-11, M-12 (shell), M-34, M-35; F-01; W-01.

**Prerequisites:** Phase 0 complete (auth spine, Prisma core, app shells, CI). Firebase project has Phone + Google providers enabled.

## Global Constraints (additional to Phase 0's)

- OTP delivery, expiry (10 min), and retry are Firebase Phone Auth's responsibility (FR-002); the API never sees passwords or OTPs.
- Auth endpoints rate-limited 5/min per identifier via `@nestjs/throttler` (NFR-023).
- Consent is blocking: a member without a current-version consent record gets `CONSENT_REQUIRED` (403) on every non-auth endpoint (FR-012).
- Plate validation: PH LTO patterns — cars `^[A-Z]{3}\s?\d{3,4}$`, motorcycles `^\d{3}\s?[A-Z]{3}$`; stored normalized (no space, uppercase). Duplicate → 409 `PLATE_ALREADY_REGISTERED` (FR-005).
- Vehicles are archived, never hard-deleted.

## Tasks

### Task 1: Schema extension — profile, organizations, vehicle photos
**Files:** `apps/api/prisma/schema.prisma` (+migration)
**Adds:** `Organization { id, name, type FLEET|INTERNAL, tin?, billingContact? }`; `User` += `address?, emergencyContactName?, emergencyContactMobile?, orgId?`; `Vehicle` += `orgOwnerId?`, `photoUrls String[]`, `orCrUrls String[]`; constraint: exactly one of `ownerUserId`/`orgOwnerId` set (DB check constraint).
**Test:** migration applies; check constraint rejects dual ownership.

### Task 2: Contracts — user, consent, vehicle schemas
**Files:** `packages/contracts/src/users.ts`, `vehicles.ts`
**Produces:** `profileUpdateSchema` (name, email, address, emergencyContact); `consentSchema { policyVersion }`; `vehicleCreateSchema` (plateNo with LTO regex + normalize transform, make, model, year 1970–next year, variant?, engineCc?, fuelType enum `GASOLINE|DIESEL|LPG|EV|HYBRID`, transmission enum `MT|AT|CVT`, odometerKm ≥0, color?, vin? 11–17 chars); `vehicleSchema` (response). Unit tests: plate regex accepts `ABA 1234`/`NBC123`, rejects `1234ABC`; normalization strips space.

### Task 3: Consent enforcement (FR-012)
**Files:** `apps/api/src/modules/users/consent.guard.ts`, `users.controller.ts` (`POST /auth/consent`), seed `POLICY_VERSION` config value.
**Behavior:** `POST /auth/consent` records `{ userId, policyVersion, ip, consentedAt }`. Global guard (after AuthGuard, skipped for `@Public()` and `/auth/*`) loads latest consent; missing or stale version → `DomainError("CONSENT_REQUIRED", …, 403)`. Staff roles exempt (they consent via employment, not in-app).
**Tests (e2e):** member without consent gets 403 on `GET /vehicles`; after consenting, 200; old `policyVersion` → 403 again after version bump.

### Task 4: CASL authorization layer (FR-007)
**Files:** `apps/api/src/common/policies/ability.factory.ts`, `policy.guard.ts`, `@CheckPolicy()` decorator.
**Produces:** `AbilityFactory.for(user): AppAbility` — MEMBER: manage own `Vehicle`/`Profile`; FLEET_MANAGER: manage org vehicles; ADMIN: manage all; MECHANIC/ADVISOR/DRIVER: read vehicles, no member PII writes. Unit-test the ability matrix directly (one `it` per role×action×subject cell that matters); this factory is extended every later phase.

### Task 5: Users module — profile, DPA rights, admin suspension
**Files:** `apps/api/src/modules/users/` (service, controller)
**Endpoints:** `GET/PATCH /users/me` (FR-011); `POST /users/me/data-export` and `POST /users/me/deletion-request` (FR-013) — each creates a `DataRequest { type, status: PENDING, requestedAt }` row and enqueues a `dpa.export` / `dpa.erasure` BullMQ job (export job: JSON dump of user's rows → signed URL, 7-day expiry; erasure job: marks for the 30-day anonymize pass — anonymize-not-delete per Data Model §8.6); `PATCH /users/:id/status` admin suspend/reactivate with required `reason`, written to `audit_log` (FR-014 — add the `audit_log` table here, Data Model §8.3).
**Tests:** suspended user's token → 403 on any endpoint; audit row written; export job produces parseable JSON.

### Task 6: Vehicles module (FR-003→FR-006, FR-048)
**Files:** `apps/api/src/modules/vehicles/`
**Endpoints:** `GET/POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id` (DELETE = `status: ARCHIVED`), `POST /vehicles/:id/odometer`.
**Behavior:** create validates via contracts schema; normalized-plate uniqueness → `PLATE_ALREADY_REGISTERED`; odometer insert rejects `km < currentOdometerKm` with `ODOMETER_REGRESSION` unless body has `justification` (then recorded and accepted, NFR-056); every accepted reading updates `Vehicle.currentOdometerKm`.
**Tests (e2e):** duplicate plate 409; regression 422 then accepted with justification; archived vehicle absent from list, present via direct GET for staff.

### Task 7: Photo upload path (FR-006)
**Files:** `apps/api/src/modules/uploads/uploads.controller.ts` (`POST /uploads/signed-url`), Firebase Storage integration in a `StoragePort` interface (NFR-037).
**Behavior:** returns `{ uploadUrl, publicUrl, expiresAt }` for content types `image/jpeg|png`, max 5 MB, path `vehicles/{vehicleId}/{uuid}.jpg`; client PATCHes `photoUrls` after upload.
**Tests:** unit with mocked storage; content-type and ownership checks.

### Task 8: Member app — onboarding flow (M-01→M-07)
**Files:** `apps/member/src/features/auth/` (Onboarding, Login, Otp, Consent screens), `features/vehicles/` (AddVehicle, VehiclePhotos, VehiclesList, VehicleDetail shell), navigation guard.
**Key decision:** use `@react-native-firebase/auth` (Expo dev client / prebuild) for phone OTP + Google sign-in — Firebase JS SDK phone auth needs a reCAPTCHA web flow that is hostile on RN. Confirm at phase start; fallback is `expo-firebase-recaptcha`.
**Flow:** splash checks SecureStore token → refresh → `POST /auth/session`; else onboarding carousel (3 cards of subscription value) → phone entry → OTP (auto-read where possible, resend timer 60 s) → Google alternative → consent screen (scrollable policy, versioned, explicit accept button) → add first vehicle (form from contracts schema — client and server share the Zod schema) → photos (optional, skip allowed) → home shell.
**Tests:** RTL component tests for form validation states; e2e happy path against local API with Firebase Auth emulator.

### Task 9: Web staff login (W-01, risk R-12)
**Files:** `apps/web/lib/auth/` (Firebase Web SDK sign-in, `POST /api/session` route handler exchanging ID token → httpOnly `ac_session` cookie: encrypted `{ uid, role }`, 12 h), `middleware.ts` upgrade (decrypt cookie, role-gate `/staff` vs `/admin`), `app/login/page.tsx` wiring, sign-out.
**Rules:** ID token never in localStorage; API requests from server components use the cookie-held token; the Route Handler contains zero domain logic (Architecture §7.4a rules).
**Tests:** middleware unit tests (no cookie → redirect; MEMBER role → redirect off `/admin`); Playwright smoke: login → land on `/staff`.

### Task 10: Auth rate limiting + session expiry (FR-015, NFR-023)
**Files:** `apps/api` throttler config (5/min on `/auth/*`, 100/min global); member app biometric unlock via `expo-local-authentication` gating SecureStore token use after 30-day inactivity check.
**Tests:** 6th auth call in a minute → 429 `RATE_LIMITED`.

## Exit criteria
- Fresh install → registered, consented member with one vehicle (validated plate, photos) entirely on iOS simulator against local API.
- Google sign-in works on iOS; staff login works on web with role-gated routing.
- CASL matrix and consent guard covered by unit/e2e tests; CI green.
- FR-001→FR-015 traceable to passing tests (update RTM notes).
