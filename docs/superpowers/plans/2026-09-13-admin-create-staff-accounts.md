# Admin Staff Account Provisioning Implementation Plan

**Goal:** Let an administrator create a usable staff account from the web portal, or promote an existing member by exact email, without widening the staff directory query across every user account.

**Architecture:** The existing `/admin/staff` page remains the staff-management surface. `GET /users/staff` becomes staff-only, while a separate exact-email candidate endpoint handles promotion using the unique `User.email` index. `POST /users/staff` provisions the identity with the Firebase Admin SDK, generates a one-time password-setup link, and then creates the matching Prisma `User` and audit entry in one database transaction. Because Firebase and Postgres cannot share a transaction, the service deletes the new Firebase identity if setup-link generation or the database transaction fails. The setup link is returned to the administrator once for manual delivery in v1 and is never persisted or logged.

**Tech Stack:** Next.js 14 App Router, React 18, NestJS 10, Prisma 5/Postgres (Supabase), Firebase Admin SDK 12, Zod contracts, Vitest/Testing Library, Jest/supertest.

**Validated platform behavior:** Firebase Admin supports server-side account creation with optional user properties and can generate a password-reset link for an existing email account. See [Manage Users](https://firebase.google.com/docs/auth/admin/manage-users) and [Generating Email Action Links](https://firebase.google.com/docs/auth/admin/email-action-links).

## Scope

Included:

- Create `MECHANIC`, `ADVISOR`, `DRIVER`, or `ADMIN` accounts from the admin web portal.
- Create both the Firebase identity and matching Postgres user record.
- Generate a password-setup link without assigning or displaying a temporary password.
- Regenerate a setup link for an existing staff account when the original response is lost.
- Promote an existing database user by exact email.
- Keep the searchable directory limited to staff roles.
- Preserve the existing role-change safeguards, shift cleanup, and audit trail.

Excluded from v1:

- Sending email from the platform. There is no email-delivery provider in the repository today; the administrator copies and sends the setup link manually.
- Bulk import, CSV upload, invitation expiry tracking, or invitation-status tables.
- Self-service role requests or non-admin account creation.
- Setting passwords in the admin portal.
- Repairing arbitrary pre-existing Firebase-only identities automatically.

## Endpoint Contract

| Method | Route | Purpose | Result |
| --- | --- | --- | --- |
| `GET` | `/users/staff?q=` | Search current staff only | `StaffDirectoryUser[]` |
| `GET` | `/users/staff-candidate?email=` | Exact lookup for an existing member | `{ user: StaffDirectoryUser \| null }` |
| `POST` | `/users/staff` | Provision Firebase identity and database user | `{ user, passwordSetupLink }` |
| `POST` | `/users/:id/password-setup-link` | Recover a setup link after a lost response | `{ passwordSetupLink }` |
| `PATCH` | `/users/:id/role` | Existing audited promotion/demotion flow | Existing response |

All four staff-management routes require the existing `can("update", "User")` policy, which is granted only to administrators. The two link-producing responses must set `Cache-Control: no-store`.

### Create request

```json
{
  "name": "Juan Dela Cruz",
  "email": "juan@example.com",
  "role": "MECHANIC",
  "reason": "Hired as workshop technician"
}
```

### Create response

```json
{
  "user": {
    "id": "uuid",
    "name": "Juan Dela Cruz",
    "email": "juan@example.com",
    "mobile": null,
    "role": "MECHANIC",
    "status": "ACTIVE",
    "upcomingShifts": 0
  },
  "passwordSetupLink": "https://..."
}
```

## Failure and Consistency Rules

1. Normalize `name` with `trim()` and `email` with `trim().toLowerCase()` at the contract boundary.
2. Reject a database email collision with HTTP `409 USER_EMAIL_ALREADY_EXISTS`; the UI should offer exact-email promotion instead.
3. Create the Firebase identity without an administrator-selected password.
4. Generate the Firebase password-reset/setup link before committing the database user. If link generation fails, delete the just-created Firebase identity.
5. Create the Postgres user and audit record in one Prisma transaction. If that transaction fails, delete the Firebase identity.
6. If compensating Firebase deletion also fails, log the Firebase UID and correlation/request ID as an operational error, but never the setup link. Return `IDENTITY_PROVISIONING_FAILED`; do not claim the operation was rolled back cleanly.
7. A network failure after a successful response may leave the account created while the browser misses the link. The regenerate endpoint is the recovery path.
8. Never persist, audit, analytics-track, or console-log `passwordSetupLink`.
9. Do not silently adopt a Firebase identity that has no matching database row. Return a conflict that tells the administrator the identity already exists and needs reconciliation; this avoids assigning privileged access to an identity through an ambiguous recovery path.

## File Structure

**Create:**

- `apps/api/test/staff-provisioning.e2e-spec.ts` — admin authorization and HTTP contract with a fake Firebase provider
- `apps/web/app/admin/staff/CreateStaffAccount.tsx` — create form and one-time setup-link result
- `apps/web/app/admin/staff/PromoteExistingMember.tsx` — exact-email lookup and promotion flow
- `apps/web/app/admin/staff/CreateStaffAccount.test.tsx`
- `apps/web/app/admin/staff/PromoteExistingMember.test.tsx`

**Modify:**

- `packages/contracts/src/users.ts`
- `packages/contracts/src/users.test.ts`
- `packages/contracts/src/errors.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/firebase.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/common/audit/audit.service.ts`
- `apps/api/src/modules/users/users.module.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/users/users.service.ts`
- `apps/api/src/modules/users/users.service.spec.ts`
- `apps/web/lib/users/api.ts`
- `apps/web/app/admin/staff/page.tsx`
- `apps/web/app/admin/staff/page.test.tsx`
- relevant environment documentation (`.env.example` or project README, whichever currently owns API variables)

## Task 1: Define shared contracts and errors

**Files:** `packages/contracts/src/users.ts`, `packages/contracts/src/users.test.ts`, `packages/contracts/src/errors.ts`

- [ ] Add `STAFF_ACCOUNT_ROLES = ["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"] as const` and reuse it for create-account validation.
- [ ] Add `staffAccountCreateSchema` with trimmed name (`2..120`), normalized email (`<=254`), staff-only role, and audited reason (`5..300`).
- [ ] Add `staffCandidateQuerySchema` containing one required normalized email. Do not accept a partial `q` value or a scope flag.
- [ ] Change `staffQuerySchema` to accept only optional `q`; remove `scope: "ALL"` from the public contract.
- [ ] Add response types for `StaffAccountCreateResult`, `StaffCandidateResult`, and `PasswordSetupLinkResult`.
- [ ] Add explicit error codes: `USER_EMAIL_ALREADY_EXISTS`, `USER_NOT_FOUND`, and `IDENTITY_PROVISIONING_FAILED`.
- [ ] Add contract tests that prove role restrictions, trimming/lowercasing, invalid email rejection, minimum reason length, and removal of the `ALL` scope.

Verification:

```bash
pnpm --filter @autocare/contracts test
pnpm --filter @autocare/contracts typecheck
```

Expected: contract tests and typecheck pass.

## Task 2: Add the staff-directory database index

**Files:** `apps/api/prisma/schema.prisma`, new generated Prisma migration

- [ ] Add `@@index([role, status])` to `User` so the normal staff query narrows by role/status before applying the optional name/email display filter.
- [ ] Generate a named migration, for example `add_user_role_status_index`.
- [ ] Confirm the existing unique `email` constraint remains in place; exact promotion lookup must use `findUnique({ where: { email } })` and not `contains`, `ILIKE`, or a list-and-filter operation.
- [ ] Before relying on normalized lookup, inspect existing non-null emails for uppercase values. If any exist, add a reviewed data migration that lowercases them only after checking for case-folded duplicates. Do not silently merge accounts.

Verification:

```bash
pnpm --filter api prisma validate
pnpm --filter api prisma generate
```

Expected: schema validates and Prisma Client includes the unchanged unique email lookup plus the new composite index.

## Task 3: Expose narrowly scoped Firebase Admin operations

**Files:** `apps/api/src/modules/auth/firebase.service.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/users/users.module.ts`

- [ ] Add typed `FirebaseService.createUser({ email, displayName })`, `deleteUser(uid)`, `getUserByEmail(email)`, and `generatePasswordResetLink(email)` methods.
- [ ] Keep Firebase initialization server-only and preserve the existing test initialization guard.
- [ ] Translate Firebase error codes in `UsersService`, not in the controller. In particular, map `auth/email-already-exists` to `USER_EMAIL_ALREADY_EXISTS` with HTTP 409.
- [ ] Export `FirebaseService` from `AuthModule` and import `AuthModule` into `UsersModule` so the users service can inject the existing initialized singleton.
- [ ] Do not expose the Admin SDK or credentials to `apps/web`.
- [ ] Add unit coverage around each thin wrapper using a mocked Admin Auth object, or keep wrappers trivial and cover calls via `UsersService` tests if direct SDK mocking would couple tests to implementation details.

Verification:

```bash
pnpm --filter api test -- firebase.service.spec
pnpm --filter api typecheck
```

Expected: API compiles and Firebase methods are callable through dependency injection without initializing real Firebase in tests.

## Task 4: Make database writes and audit writes atomic

**Files:** `apps/api/src/common/audit/audit.service.ts`, its tests if present

- [ ] Add an audit method that accepts a Prisma transaction client, while keeping the existing `record(...)` API for current callers.
- [ ] Implement `record(...)` by delegating to the shared internal write logic so audit formatting does not diverge.
- [ ] Use the transaction-aware method during staff account creation so a user record cannot commit without its privileged-action audit row.
- [ ] Audit action: `user.staff.created:<reason>`; `before` is `null`; `after` may contain user ID, normalized email, role, and status, but must never contain the password-setup link.

Verification:

```bash
pnpm --filter api test -- audit
pnpm --filter api typecheck
```

Expected: old audit callers still compile, and transaction-scoped writes use the supplied client.

## Task 5: Implement provisioning, exact lookup, and link recovery

**Files:** `apps/api/src/modules/users/users.service.ts`, `apps/api/src/modules/users/users.service.spec.ts`

- [ ] Inject `FirebaseService` into `UsersService` and update the existing test factory with a fake.
- [ ] Remove `scope === "ALL"` handling from `staffDirectory()`. Always constrain roles to `STAFF_ROLES`; keep `take: 100` as a defensive cap.
- [ ] Add `findStaffCandidateByEmail(email)` using a single unique email lookup. Return `null` when absent and the narrow `StaffDirectoryUser` shape when present.
- [ ] Add `createStaffAccount(actorId, dto)` with the exact order specified in “Failure and Consistency Rules.” Set `status: ACTIVE`, store the Firebase UID, and return `upcomingShifts: 0`.
- [ ] Check Prisma first for an existing normalized email and return a 409 directing the UI toward promotion.
- [ ] Handle the race where Prisma unique insertion fails after Firebase creation: compensate by deleting only the UID created by this request.
- [ ] Add `generateStaffPasswordSetupLink(targetUserId)` that loads only `firebaseUid`, `email`, `role`, and `status`; reject missing users, non-staff roles, missing emails, and suspended users.
- [ ] Unit-test all consistency branches:
  - successful Firebase/link/database/audit sequence;
  - database duplicate detected before Firebase creation;
  - Firebase duplicate mapped to 409;
  - setup-link failure deletes the newly created Firebase user;
  - database failure deletes the newly created Firebase user;
  - compensation failure produces an operational error without leaking the setup link;
  - successful response contains the link but the audit payload does not;
  - exact lookup calls `findUnique`, never `findMany`;
  - staff directory always supplies a staff-role filter.

Verification:

```bash
pnpm --filter api test -- users.service.spec
pnpm --filter api typecheck
```

Expected: all provisioning and rollback branches pass without contacting Firebase or Supabase.

## Task 6: Add protected HTTP routes and throttling

**Files:** `apps/api/src/modules/users/users.controller.ts`, `apps/api/test/staff-provisioning.e2e-spec.ts`

- [ ] Add `GET /users/staff-candidate`, `POST /users/staff`, and `POST /users/:id/password-setup-link` with Zod pipes and `@CheckPolicy((a) => a.can("update", "User"))`.
- [ ] Put the static `staff-candidate` and `staff` routes before `:id` routes to avoid path ambiguity.
- [ ] Apply a tighter per-route throttle to account creation and link generation (initial target: 10 requests per minute per authenticated administrator).
- [ ] Set `Cache-Control: no-store` for responses containing setup links.
- [ ] Keep response wrapping and errors consistent with the repository’s global API envelope.
- [ ] In e2e tests, override `FirebaseService` with a deterministic fake. Never create real Firebase users from CI.
- [ ] Cover unauthenticated 401, non-admin 403, invalid payload 400, duplicate 409, successful 201, exact lookup, and setup-link regeneration.
- [ ] Use prefix-scoped test records and cleanup; never truncate the shared hosted database.

Verification:

```bash
pnpm --filter api test -- staff-provisioning.e2e-spec
```

Expected: route policy, validation, status codes, response envelopes, and cache headers pass.

## Task 7: Extend the web API client

**Files:** `apps/web/lib/users/api.ts` and associated tests if the project keeps client tests separately

- [ ] Remove `scope` from `getStaff()` and stop sending it in the query string.
- [ ] Add `createStaffAccount(dto)`, `findStaffCandidate(email)`, and `generatePasswordSetupLink(id)`.
- [ ] Import shared request/response types from `@autocare/contracts` instead of duplicating shapes where practical.
- [ ] Preserve the same-origin BFF call helper; do not place Firebase Admin credentials or user tokens in browser code.
- [ ] Ensure errors expose the API’s safe message but never log a response body containing a setup link.

Verification:

```bash
pnpm --filter web typecheck
```

Expected: the client compiles and no call includes `scope=ALL`.

## Task 8: Build the admin create-account experience

**Files:** `apps/web/app/admin/staff/CreateStaffAccount.tsx`, its test, `apps/web/app/admin/staff/page.tsx`, `apps/web/app/admin/staff/page.test.tsx`

- [ ] Add a prominent “Create staff account” action above the existing directory.
- [ ] Build an accessible form with full name, email, staff role, and audit reason. Exclude `MEMBER` and `FLEET_MANAGER` from role choices.
- [ ] Require explicit confirmation before provisioning an `ADMIN` account and explain that it grants full portal access.
- [ ] Disable double-submit and show a clear progress label such as “Creating account…”.
- [ ] On success, replace the form with the account summary and a one-time setup-link panel containing “Copy setup link” and “Done.”
- [ ] Treat the link as sensitive UI state: do not put it in the URL, local storage, session storage, telemetry, or generic page messages; clear it when the panel closes or the component unmounts.
- [ ] If the API returns `USER_EMAIL_ALREADY_EXISTS`, keep the entered email and offer to open the exact promotion flow.
- [ ] Refresh the staff list only after successful creation; a failed request must keep the entered form values except any link.
- [ ] Add a per-row “Generate setup link” action with confirmation for recovery. Do not display it for suspended users.
- [ ] Test validation, loading/disabled state, admin-role confirmation, success copy interaction, duplicate handoff, safe link clearing, error recovery, and list refresh.

Verification:

```bash
pnpm --filter web test -- CreateStaffAccount
pnpm --filter web test -- app/admin/staff/page.test.tsx
pnpm --filter web typecheck
```

Expected: component tests pass and the page remains usable with keyboard and labeled controls.

## Task 9: Replace broad promotion search with exact-email promotion

**Files:** `apps/web/app/admin/staff/PromoteExistingMember.tsx`, its test, `apps/web/app/admin/staff/page.tsx`, `apps/web/app/admin/staff/page.test.tsx`

- [ ] Remove the “Everyone (to promote a member)” directory option and its first-sign-in copy.
- [ ] Keep the main search input for current staff only.
- [ ] Add a separate “Promote existing member” panel requiring a complete email address before it calls the API.
- [ ] Show at most one candidate with name, email, current role, and status. Do not show unrelated suggestions or partial matches.
- [ ] Reuse the existing role-change confirmation and mandatory reason path rather than creating a second mutation implementation.
- [ ] If the exact user is already staff, link/scroll to that staff row instead of offering a redundant promotion.
- [ ] Test that an empty or partial email performs no request, a complete email performs one exact lookup, no-match state is clear, and promotion refreshes the staff-only list.

Verification:

```bash
pnpm --filter web test -- PromoteExistingMember
pnpm --filter web test -- app/admin/staff/page.test.tsx
```

Expected: there is no UI path that requests all users, and promotion remains available by exact email.

## Task 10: Configuration, manual acceptance, and full verification

**Files:** environment documentation and operational runbook/README owning Firebase setup

- [ ] Document that the API’s Firebase service account must have permission to manage Authentication users.
- [ ] Document the Firebase Authentication email action configuration and authorized domains needed for generated setup links.
- [ ] Document v1 delivery: the administrator must send the copied link through an approved channel because the app does not yet have an email provider.
- [ ] Add a note that setup links should not be pasted into issue trackers, logs, or analytics.
- [ ] Run the full repository checks.

```bash
pnpm turbo run typecheck lint test
```

- [ ] Perform a staging acceptance test with disposable, prefix-tagged addresses:
  1. Sign in to the web portal as an administrator.
  2. Create one disposable mechanic account.
  3. Confirm it appears immediately in the staff-only directory.
  4. Open the generated setup link, set a password, and sign in to the field app.
  5. Confirm the field app receives the expected role and access.
  6. Create a normal member, locate it through exact email, promote it, and confirm it appears in the staff directory.
  7. Confirm partial email text never returns member suggestions.
  8. Confirm the audit log records both creation and promotion reasons without setup links.
  9. Delete the disposable Firebase and database users using an approved, targeted cleanup procedure.

Expected: all automated checks pass, created staff can authenticate, exact promotion works, broad account enumeration is gone, and audit/link handling meets the security rules.

## Release Order and Rollback

1. Deploy the database index migration.
2. Deploy the API contracts/routes/service changes.
3. Deploy the web portal changes.
4. Run one staging provisioning acceptance test before enabling production administrators to use the form.

Rollback the web UI first if provisioning has a UX defect; the existing role endpoint remains available. If the API must be rolled back, remove or disable the new create/link routes before reverting shared contracts. The additive database index can remain safely in place. Any failed provisioning request with a reported compensation failure requires a targeted Firebase UID/database email reconciliation before retrying.

## Definition of Done

- An administrator can create a staff identity and receive a password-setup link without manually touching Firebase or Supabase.
- A created staff user can set a password and sign in with the assigned role.
- Existing members can be promoted only through exact-email lookup.
- The normal staff screen never requests or scans an unrestricted all-user directory.
- Duplicate, partial-failure, and lost-response cases have tested recovery behavior.
- Creation and promotion are audited with reasons, and setup links are absent from persistence and logs.
- Contract, API unit/e2e, web component, typecheck, lint, and full test suites pass.
