# Phase 1 — Identity & Vehicles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Database superseded 2026-08-23:** manual-verification steps below reference a local API over Docker Compose Postgres (as executed at the time). The current database of record is **hosted Supabase Postgres** — see the roadmap's 2026-08-23 note and `docs/checkpoints/2026-08-23-secure-store-crash-and-supabase-db-migration.md`.

**Goal:** A member can register with email/password or Google, accept the DPA consent, manage their profile, and put vehicles on file with validated plates and photos — end-to-end on iOS + API; staff can sign in on web and in the field app.

**Architecture:** Everything builds on Phase 0's spine: Firebase ID tokens exchanged at `POST /api/v1/auth/session`, envelope responses, `DomainError` with machine codes, shared Zod contracts consumed by all clients. Phase 1 adds three API layers that every later phase reuses — the consent guard (FR-012), the CASL ability factory (FR-007), and the append-only `audit_log` — plus the vehicles domain, DPA request jobs on BullMQ, signed-URL uploads behind a `StoragePort`, and the member onboarding flow on iOS.

**Tech Stack:** Adds to Phase 0's: `@casl/ability` 6, `@nestjs/bullmq` + `bullmq`, `@nestjs/throttler`, `@react-native-firebase/app`+`auth` (Expo dev client), `@react-native-google-signin/google-signin`, `expo-image-picker`, `expo-local-authentication`, `firebase` (web SDK), `jose` (cookie encryption), `@playwright/test`.

**Covers:** M1 (FR-001→FR-015). Screens M-01→M-07, M-11, M-12 (shell), M-34, M-35; F-01; W-01.
**Coverage note:** FR-008/FR-009 (fleet manager corporate accounts, driver assignment) are satisfied here at the **data + authorization layer only** (`Organization` model, org-owned vehicles, FLEET_MANAGER abilities); the fleet UX (M-37, CSV import) is Phase 7 per the roadmap. FR-001's "email + password" and FR-010's password reset are fulfilled by **Firebase Email/Password Auth** — Firebase owns credential storage, the verification email, and the reset link; the API never sees a password. Phone/SMS OTP is out of scope for v1.0 (Architecture §7.3a): it is a Blaze-tier billed feature and put a paid SMS vendor in the registration critical path. `mobile` is still collected at registration as a contact detail for roadside dispatch and FR-091 SMS fallback.

**Prerequisites:** Phase 0 complete (auth spine, Prisma core, app shells, CI green). Firebase project has **Email/Password** and **Google** providers enabled (no Blaze upgrade required — Phone is not used), with the verification and password-reset email templates configured, plus at least one **staff account** for web/field login. A **private Supabase Storage bucket** exists in the same Supabase project as the database, and the API env carries the service-role key.

## Global Constraints (additional to Phase 0's)

- Credential storage, the verification email (FR-002), and the password-reset link (FR-010) are Firebase Email/Password Auth's responsibility; the API never sees a password. Email verification is enforced server-side by reading the `email_verified` claim on the decoded token, never by trusting the client.
- Auth endpoints rate-limited 5/min per caller via `@nestjs/throttler`; global default 100/min (NFR-023).
- Consent is blocking: a MEMBER or FLEET_MANAGER without a current-version consent record gets `CONSENT_REQUIRED` (403) on every non-auth endpoint (FR-012). Staff roles are exempt (they consent via employment).
- Plate validation: PH LTO patterns — cars `^[A-Z]{3}\s?\d{3,4}$`, motorcycles `^\d{3}\s?[A-Z]{3}$`; stored normalized (no space, uppercase). Duplicate → 409 `PLATE_ALREADY_REGISTERED` (FR-005).
- Vehicles are archived, never hard-deleted. A vehicle is owned by a user **or** an organization, never both (Data Model §8.3).
- `audit_log` is append-only — no update or delete paths, ever (NFR-021).
- DPA erasure = anonymize, don't delete: strip personal identifiers, keep vehicle history keyed to plate (Data Model §8.6).
- New env vars must be added to `.env.example` and the Zod `envSchema` in the same commit — the API crashes on missing vars by design.

---

### Task 1: Schema extension — organizations, profile, vehicle photos

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration `add-orgs-profile-vehicle-photos` (generated)
- Test: `apps/api/test/schema-phase1.e2e-spec.ts`

**Interfaces:**
- Consumes: Phase 0 models `User`, `Vehicle`, `OdometerReading`.
- Produces: `Organization` model; `User.address/emergencyContactName/emergencyContactMobile/orgId/erasureRequestedAt`; `Vehicle.orgOwnerId/photoUrls/orCrUrls`; `OdometerReading.justification`; DB check constraint `vehicles_single_owner_check` (exactly one owner). Later tasks rely on these exact field names.

- [ ] **Step 1: Write the failing e2e test**

`test/schema-phase1.e2e-spec.ts`:
```typescript
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("phase 1 schema (e2e)", () => {
  const prisma = new PrismaService();
  afterAll(async () => {
    await prisma.vehicle.deleteMany({ where: { plateNo: { in: ["ORG9999", "DUO8888"] } } });
    await prisma.organization.deleteMany({ where: { name: "Test Fleet Co" } });
    await prisma.user.deleteMany({ where: { firebaseUid: "schema-test-uid" } });
    await prisma.$disconnect();
  });

  it("creates an org-owned vehicle with photo arrays", async () => {
    const org = await prisma.organization.create({ data: { name: "Test Fleet Co", type: "FLEET" } });
    const v = await prisma.vehicle.create({
      data: { orgOwnerId: org.id, plateNo: "ORG9999", make: "Isuzu", model: "Traviz", year: 2022,
              fuelType: "DIESEL", transmission: "MT", photoUrls: ["https://x/1.jpg"], orCrUrls: [] },
    });
    expect(v.photoUrls).toEqual(["https://x/1.jpg"]);
  });

  it("check constraint rejects a vehicle with both owners", async () => {
    const user = await prisma.user.create({ data: { firebaseUid: "schema-test-uid" } });
    const org = await prisma.organization.findFirstOrThrow({ where: { name: "Test Fleet Co" } });
    await expect(prisma.vehicle.create({
      data: { ownerUserId: user.id, orgOwnerId: org.id, plateNo: "DUO8888", make: "T", model: "V",
              year: 2020, fuelType: "GASOLINE", transmission: "AT" },
    })).rejects.toThrow();
  });

  it("check constraint rejects a vehicle with no owner", async () => {
    await expect(prisma.vehicle.create({
      data: { plateNo: "DUO8888", make: "T", model: "V", year: 2020, fuelType: "GASOLINE", transmission: "AT" },
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- schema-phase1`
Expected: FAIL — `prisma.organization` undefined, `orgOwnerId` unknown.

- [ ] **Step 3: Extend the schema**

Append/modify in `prisma/schema.prisma`:
```prisma
enum OrgType { FLEET INTERNAL }

model Organization {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  type           OrgType
  tin            String?
  billingContact String?  @map("billing_contact")
  createdAt      DateTime @default(now()) @map("created_at")
  members        User[]
  vehicles       Vehicle[]
  @@map("organizations")
}
```

`User` gains (keep existing fields untouched):
```prisma
  address                String?
  emergencyContactName   String?       @map("emergency_contact_name")
  emergencyContactMobile String?       @map("emergency_contact_mobile")
  orgId                  String?       @map("org_id") @db.Uuid
  org                    Organization? @relation(fields: [orgId], references: [id])
  erasureRequestedAt     DateTime?     @map("erasure_requested_at")
```

`Vehicle` gains:
```prisma
  orgOwnerId String?       @map("owner_org_id") @db.Uuid
  orgOwner   Organization? @relation(fields: [orgOwnerId], references: [id])
  photoUrls  String[]      @default([]) @map("photo_urls")
  orCrUrls   String[]      @default([]) @map("or_cr_urls")
```

`OdometerReading` gains:
```prisma
  justification String?
```

- [ ] **Step 4: Generate migration and add the check constraint**

Run: `cd apps/api && pnpm prisma migrate dev --name add-orgs-profile-vehicle-photos --create-only`
Then append to the generated `migration.sql` (Prisma cannot express check constraints):
```sql
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_single_owner_check"
  CHECK (num_nonnulls("owner_user_id", "owner_org_id") = 1);
```
Note: if Phase 0 left any test vehicle rows with a NULL owner, delete them first (`DELETE FROM vehicles WHERE owner_user_id IS NULL AND owner_org_id IS NULL;` at the top of the same migration).
Run: `pnpm prisma migrate dev`
Expected: migration applies cleanly.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter api test -- schema-phase1` → 3 PASS. Also update the Phase 0 `prisma.e2e-spec.ts` if its fixture now violates the constraint (it creates an owned vehicle, so it should still pass — verify with `pnpm --filter api test`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/test/schema-phase1.e2e-spec.ts
git commit -m "feat(api): orgs, profile fields, vehicle photos + single-owner check constraint"
```

---

### Task 2: Contracts — user, consent, vehicle schemas; api-client `del`

**Files:**
- Create: `packages/contracts/src/users.ts`, `packages/contracts/src/vehicles.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/src/auth.ts`, `packages/api-client/src/client.ts`
- Test: `packages/contracts/src/vehicles.test.ts`, `packages/contracts/src/users.test.ts`, `packages/api-client/src/client.test.ts` (extend)

**Interfaces:**
- Consumes: `roles`, `sessionResponseSchema` from Phase 0 contracts.
- Produces (all later tasks import these exact names):
  - `plateSchema`, `normalizePlate(raw: string): string`, `fuelTypes`, `transmissions`
  - `vehicleCreateSchema`, `VehicleCreate`; `vehicleUpdateSchema`, `VehicleUpdate`; `vehicleSchema`, `Vehicle`; `odometerCreateSchema`, `OdometerCreate`
  - `profileUpdateSchema`, `ProfileUpdate`; `consentSchema`; `userStatusUpdateSchema`
  - `sessionResponseSchema` gains `consentRequired: boolean`
  - `ApiClient.del<T>(path): Promise<T>`

- [ ] **Step 1: Write the failing tests**

`src/vehicles.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { vehicleCreateSchema, odometerCreateSchema, normalizePlate } from "./vehicles";

const base = { make: "Toyota", model: "Vios", year: 2019, fuelType: "GASOLINE", transmission: "AT", odometerKm: 42000 };

describe("vehicle contracts", () => {
  it("accepts car plates with or without space, normalized", () => {
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "ABA 1234" }).plateNo).toBe("ABA1234");
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "nbc123" }).plateNo).toBe("NBC123");
  });
  it("accepts motorcycle plates (digits-first)", () => {
    expect(vehicleCreateSchema.parse({ ...base, plateNo: "123 ABC" }).plateNo).toBe("123ABC");
  });
  it("rejects non-LTO patterns", () => {
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "1234ABC" })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "AB 12" })).toThrow();
  });
  it("bounds year to 1970..next year and vin to 11-17 chars", () => {
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", year: 1969 })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", year: new Date().getFullYear() + 2 })).toThrow();
    expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", vin: "SHORT" })).toThrow();
  });
  it("normalizePlate strips whitespace and uppercases", () => {
    expect(normalizePlate(" aba 1234 ")).toBe("ABA1234");
  });
  it("odometer justification is optional but non-trivial when present", () => {
    expect(odometerCreateSchema.parse({ km: 100 }).justification).toBeUndefined();
    expect(() => odometerCreateSchema.parse({ km: 100, justification: "x" })).toThrow();
  });
});
```

`src/users.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { profileUpdateSchema, consentSchema, userStatusUpdateSchema } from "./users";

describe("user contracts", () => {
  it("accepts a partial profile update", () => {
    const p = profileUpdateSchema.parse({ name: "Juan Dela Cruz", emergencyContactMobile: "+639171234567" });
    expect(p.name).toBe("Juan Dela Cruz");
  });
  it("rejects a non-PH emergency mobile", () => {
    expect(() => profileUpdateSchema.parse({ emergencyContactMobile: "0917123" })).toThrow();
  });
  it("consent requires a policy version", () => {
    expect(() => consentSchema.parse({})).toThrow();
    expect(consentSchema.parse({ policyVersion: "2026-08-privacy-v1" }).policyVersion).toBe("2026-08-privacy-v1");
  });
  it("status update requires a reason of substance", () => {
    expect(() => userStatusUpdateSchema.parse({ status: "SUSPENDED", reason: "no" })).toThrow();
    expect(userStatusUpdateSchema.parse({ status: "SUSPENDED", reason: "chargeback abuse" }).status).toBe("SUSPENDED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @autocare/contracts test` → FAIL (modules missing).

- [ ] **Step 3: Implement the schemas**

`src/vehicles.ts`:
```typescript
import { z } from "zod";

/** PH LTO plate patterns: cars LLL-DDD(D), motorcycles DDD-LLL (Global Constraints). */
export const PLATE_PATTERNS = [/^[A-Z]{3}\s?\d{3,4}$/, /^\d{3}\s?[A-Z]{3}$/];
export const normalizePlate = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "");

export const plateSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => PLATE_PATTERNS.some((p) => p.test(s)), { message: "Not a valid PH plate (e.g. ABA 1234 or 123 ABC)" })
  .transform(normalizePlate);

export const fuelTypes = ["GASOLINE", "DIESEL", "LPG", "EV", "HYBRID"] as const;
export const transmissions = ["MT", "AT", "CVT"] as const;

export const vehicleCreateSchema = z.object({
  plateNo: plateSchema,
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  variant: z.string().max(60).optional(),
  engineCc: z.number().int().positive().max(10000).optional(),
  fuelType: z.enum(fuelTypes),
  transmission: z.enum(transmissions),
  odometerKm: z.number().int().min(0),
  color: z.string().max(30).optional(),
  vin: z.string().min(11).max(17).optional(),
});
export type VehicleCreate = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema
  .omit({ plateNo: true, odometerKm: true }) // plate is identity; odometer has its own endpoint
  .partial()
  .extend({
    photoUrls: z.array(z.string().url()).max(10).optional(),
    orCrUrls: z.array(z.string().url()).max(4).optional(),
  });
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;

export const vehicleSchema = z.object({
  id: z.string().uuid(),
  plateNo: z.string(),
  make: z.string(), model: z.string(), year: z.number().int(),
  variant: z.string().nullable(), engineCc: z.number().int().nullable(),
  fuelType: z.enum(fuelTypes), transmission: z.enum(transmissions),
  color: z.string().nullable(), vin: z.string().nullable(),
  photoUrls: z.array(z.string()), orCrUrls: z.array(z.string()),
  currentOdometerKm: z.number().int(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const odometerCreateSchema = z.object({
  km: z.number().int().min(0),
  justification: z.string().min(5).max(300).optional(),
});
export type OdometerCreate = z.infer<typeof odometerCreateSchema>;
```

`src/users.ts`:
```typescript
import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  emergencyContactName: z.string().max(120).optional(),
  emergencyContactMobile: z.string().regex(/^\+63\d{10}$/, "Use +63 format, e.g. +639171234567").optional(),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const consentSchema = z.object({ policyVersion: z.string().min(1) });

export const userStatusUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().min(5).max(300),
});
export type UserStatusUpdate = z.infer<typeof userStatusUpdateSchema>;
```

In `src/auth.ts`, extend the session response (Task 3 implements the server side):
```typescript
export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(), firebaseUid: z.string(), name: z.string().nullable(),
    mobile: z.string().nullable(), email: z.string().nullable(), role: z.enum(roles),
  }),
  consentRequired: z.boolean(),
});
```

`src/index.ts` re-exports `./users` and `./vehicles`.

- [ ] **Step 4: Add `del` to the api client (test first)**

Append to `packages/api-client/src/client.test.ts`:
```typescript
  it("supports DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ id: "v1", status: "ARCHIVED" }));
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "tok", fetchImpl: fetchMock as any });
    const out = await api.del<{ status: string }>("/vehicles/v1");
    expect(out.status).toBe("ARCHIVED");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
```
Run `pnpm --filter @autocare/api-client test` → new test FAILS. Then add to the returned object in `client.ts`:
```typescript
    del: <T>(p: string) => call<T>("DELETE", p),
```

- [ ] **Step 5: Run all package tests to verify they pass**

Run: `pnpm --filter @autocare/contracts test && pnpm --filter @autocare/api-client test` → PASS.
Note: the Phase 0 contracts envelope test still passes untouched.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts packages/api-client
git commit -m "feat(contracts): user/consent/vehicle schemas with LTO plate validation; api-client DELETE"
```

---

### Task 3: Consent enforcement + Zod validation pipe (FR-012)

**Files:**
- Create: `apps/api/src/common/pipes/zod-validation.pipe.ts`, `apps/api/src/modules/users/consent.guard.ts`, `apps/api/src/modules/users/users.module.ts` (guard registration only for now), `apps/api/src/modules/users/consent.controller.ts`
- Modify: `apps/api/src/config/env.ts` (+`POLICY_VERSION`), `.env.example`, `apps/api/src/modules/auth/auth.service.ts` (session gains `consentRequired`), `apps/api/src/app.module.ts`
- Test: `apps/api/test/consent.e2e-spec.ts`

**Interfaces:**
- Consumes: `DomainError`, `AuthGuard`/`@Public()` (Phase 0 Task 7), `PrismaService`, `consentSchema` (Task 2).
- Produces: `ZodValidationPipe` — `@Body(new ZodValidationPipe(schema))`, throws `BadRequestException` with issue summary (rendered as 400 `HTTP_ERROR` by the Phase 0 filter); `POST /api/v1/auth/consent` body `{ policyVersion }` → `{ consentedAt: string }`; global `ConsentGuard` registered **after** `AuthGuard` — blocks MEMBER/FLEET_MANAGER without a `ConsentRecord` matching `env.POLICY_VERSION`; `POST /auth/session` response now includes `consentRequired`.

- [ ] **Step 1: Write the failing e2e test**

`test/consent.e2e-spec.ts` (same `FirebaseService` override pattern as Phase 0's auth e2e):
```typescript
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const POLICY = "2026-08-privacy-v1";

describe("consent (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async () => ({ uid: "consent-uid", phone: "+639171112222" }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: "consent-uid" } } });
    await prisma.user.deleteMany({ where: { firebaseUid: "consent-uid" } });
    await app.close();
  });

  const auth = (r: request.Test) => r.set("Authorization", "Bearer t");

  it("session reports consentRequired=true for a fresh member", async () => {
    const res = await auth(request(app.getHttpServer()).post("/api/v1/auth/session")).expect(201);
    expect(res.body.data.consentRequired).toBe(true);
  });
  it("blocks a non-auth endpoint with CONSENT_REQUIRED before consent", async () => {
    const res = await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(403);
    expect(res.body.error.code).toBe("CONSENT_REQUIRED");
  });
  it("rejects a consent body missing policyVersion with 400", async () => {
    await auth(request(app.getHttpServer()).post("/api/v1/auth/consent").send({})).expect(400);
  });
  it("unblocks after consenting to the current version", async () => {
    await auth(request(app.getHttpServer()).post("/api/v1/auth/consent").send({ policyVersion: POLICY })).expect(201);
    await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(200);
    const res = await auth(request(app.getHttpServer()).post("/api/v1/auth/session"));
    expect(res.body.data.consentRequired).toBe(false);
  });
  it("re-blocks after a policy version bump", async () => {
    process.env.POLICY_VERSION = "2026-12-privacy-v2";
    const res = await auth(request(app.getHttpServer()).get("/api/v1/users/me")).expect(403);
    expect(res.body.error.code).toBe("CONSENT_REQUIRED");
    process.env.POLICY_VERSION = POLICY;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- consent`
Expected: FAIL — no `/auth/consent` route; `/users/me` returns 200 without consent; session lacks `consentRequired`.

- [ ] **Step 3: Implement pipe, guard, controller**

`src/common/pipes/zod-validation.pipe.ts`:
```typescript
import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodTypeAny) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const detail = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
      throw new BadRequestException(detail);
    }
    return result.data;
  }
}
```

Add `POLICY_VERSION: z.string().min(1)` to `envSchema`; add `POLICY_VERSION=2026-08-privacy-v1` to `.env.example` and the CI workflow env block.

`src/modules/users/consent.guard.ts` — read `POLICY_VERSION` from `process.env` at request time (not module load) so version bumps and tests behave:
```typescript
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";

const CONSENTING_ROLES = new Set(["MEMBER", "FLEET_MANAGER"]);

@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest();
    if (req.path.startsWith("/api/v1/auth/")) return true; // consent itself + session must stay reachable
    const user = req.user;
    if (!user || !CONSENTING_ROLES.has(user.role)) return true; // staff consent via employment
    const consent = await this.prisma.consentRecord.findFirst({
      where: { userId: user.id, policyVersion: process.env.POLICY_VERSION, withdrawnAt: null },
    });
    if (!consent) throw new DomainError("CONSENT_REQUIRED", "Please accept the current privacy policy to continue", 403);
    return true;
  }
}
```

`src/modules/users/consent.controller.ts`:
```typescript
import { Body, Controller, Ip, Post } from "@nestjs/common";
import { consentSchema } from "@autocare/contracts";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";

@Controller("auth")
export class ConsentController {
  constructor(private prisma: PrismaService) {}
  @Post("consent")
  async consent(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(consentSchema)) body: z.infer<typeof consentSchema>,
    @Ip() ip: string,
  ) {
    const rec = await this.prisma.consentRecord.create({
      data: { userId: user.id, policyVersion: body.policyVersion, ip },
    });
    return { consentedAt: rec.consentedAt.toISOString() };
  }
}
```

In `auth.service.ts#createSession`, after the upsert compute:
```typescript
    const consentRequired = ["MEMBER", "FLEET_MANAGER"].includes(user.role)
      ? !(await this.prisma.consentRecord.findFirst({
          where: { userId: user.id, policyVersion: process.env.POLICY_VERSION, withdrawnAt: null },
        }))
      : false;
    return { user: { /* unchanged */ }, consentRequired };
```

`users.module.ts` declares `ConsentController` and provides `{ provide: APP_GUARD, useClass: ConsentGuard }`; import `UsersModule` into `AppModule` **after** `AuthModule` (Nest runs global guards in provider-registration order, so `AuthGuard` populates `req.user` first).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- consent` → 5 PASS. Run the full suite (`pnpm --filter api test`) — Phase 0's auth e2e still passes because `/auth/*` is exempt.

- [ ] **Step 5: Commit**

```bash
git add apps/api .env.example .github
git commit -m "feat(api): blocking DPA consent guard, consent endpoint, zod validation pipe (FR-012)"
```

---

### Task 4: CASL authorization layer (FR-007)

**Files:**
- Create: `apps/api/src/common/policies/ability.factory.ts`, `apps/api/src/common/policies/policy.guard.ts`, `apps/api/src/common/policies/check-policy.decorator.ts`, `apps/api/src/common/policies/policies.module.ts`
- Test: `apps/api/src/common/policies/ability.factory.spec.ts`

**Interfaces:**
- Consumes: `Role` from `@autocare/contracts`.
- Produces (every later phase extends this):
  - `type Action = "manage" | "create" | "read" | "update" | "delete"`
  - `type Subjects = "Vehicle" | "Profile" | "User" | "Organization" | "all"` (union grows per phase)
  - `AbilityFactory.for(user: { id: string; role: Role; orgId?: string | null }): AppAbility`
  - `@CheckPolicy((ability) => ability.can("read", "Vehicle"))` route decorator + global `PolicyGuard` that also attaches `req.ability`
  - Row-level checks in services: `ability.can("update", subject("Vehicle", vehicleRow))` (`subject` re-exported from `@casl/ability`)

- [ ] **Step 1: Add dependency**

Run: `pnpm --filter api add @casl/ability@^6.7.0`

- [ ] **Step 2: Write the failing ability-matrix unit test**

`src/common/policies/ability.factory.spec.ts` (Jest):
```typescript
import { subject } from "@casl/ability";
import { AbilityFactory } from "./ability.factory";

const f = new AbilityFactory();
const member = { id: "u1", role: "MEMBER" as const, orgId: null };
const fleet = { id: "u2", role: "FLEET_MANAGER" as const, orgId: "org1" };
const mechanic = { id: "u3", role: "MECHANIC" as const, orgId: null };
const admin = { id: "u4", role: "ADMIN" as const, orgId: null };

const ownVehicle = subject("Vehicle", { ownerUserId: "u1", orgOwnerId: null });
const strangersVehicle = subject("Vehicle", { ownerUserId: "u9", orgOwnerId: null });
const orgVehicle = subject("Vehicle", { ownerUserId: null, orgOwnerId: "org1" });
const otherOrgVehicle = subject("Vehicle", { ownerUserId: null, orgOwnerId: "org2" });

describe("ability matrix (FR-007)", () => {
  it("MEMBER manages own vehicle, not a stranger's", () => {
    const a = f.for(member);
    expect(a.can("update", ownVehicle)).toBe(true);
    expect(a.can("delete", ownVehicle)).toBe(true);
    expect(a.can("update", strangersVehicle)).toBe(false);
    expect(a.can("read", strangersVehicle)).toBe(false);
  });
  it("MEMBER updates own profile only, and never other Users", () => {
    const a = f.for(member);
    expect(a.can("update", subject("Profile", { id: "u1" }))).toBe(true);
    expect(a.can("update", subject("Profile", { id: "u9" }))).toBe(false);
    expect(a.can("update", "User")).toBe(false);
  });
  it("FLEET_MANAGER manages own-org vehicles only", () => {
    const a = f.for(fleet);
    expect(a.can("update", orgVehicle)).toBe(true);
    expect(a.can("update", otherOrgVehicle)).toBe(false);
    expect(a.can("update", strangersVehicle)).toBe(false);
  });
  it("MECHANIC reads any vehicle but writes none, and cannot touch member PII", () => {
    const a = f.for(mechanic);
    expect(a.can("read", strangersVehicle)).toBe(true);
    expect(a.can("update", strangersVehicle)).toBe(false);
    expect(a.can("update", subject("Profile", { id: "u9" }))).toBe(false);
    expect(a.can("read", subject("Profile", { id: "u3" }))).toBe(true);
  });
  it("ADMIN manages everything", () => {
    const a = f.for(admin);
    expect(a.can("manage", "all")).toBe(true);
    expect(a.can("update", "User")).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter api test -- ability.factory` → FAIL (module missing).

- [ ] **Step 4: Implement factory, decorator, guard**

`src/common/policies/ability.factory.ts`:
```typescript
import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";
import { Injectable } from "@nestjs/common";
import type { Role } from "@autocare/contracts";

export type Action = "manage" | "create" | "read" | "update" | "delete";
export type Subjects = "Vehicle" | "Profile" | "User" | "Organization" | "all";
export type AppAbility = MongoAbility<[Action, Subjects | Record<string, unknown>]>;
export interface AbilityUser { id: string; role: Role; orgId?: string | null }

@Injectable()
export class AbilityFactory {
  for(user: AbilityUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    switch (user.role) {
      case "ADMIN":
        can("manage", "all");
        break;
      case "MEMBER":
        can("create", "Vehicle");
        can("manage", "Vehicle", { ownerUserId: user.id });
        can(["read", "update"], "Profile", { id: user.id });
        break;
      case "FLEET_MANAGER":
        if (user.orgId) {
          can("create", "Vehicle");
          can("manage", "Vehicle", { orgOwnerId: user.orgId });
          can("read", "Organization", { id: user.orgId });
        }
        can(["read", "update"], "Profile", { id: user.id });
        break;
      case "MECHANIC":
      case "ADVISOR":
      case "DRIVER":
        can("read", "Vehicle"); // no owner condition — staff see all vehicles, write none
        can(["read", "update"], "Profile", { id: user.id });
        break;
    }
    return build();
  }
}
```

`src/common/policies/check-policy.decorator.ts`:
```typescript
import { SetMetadata } from "@nestjs/common";
import type { AppAbility } from "./ability.factory";

export type PolicyHandler = (ability: AppAbility) => boolean;
export const CHECK_POLICY_KEY = "check_policy";
export const CheckPolicy = (...handlers: PolicyHandler[]) => SetMetadata(CHECK_POLICY_KEY, handlers);
```

`src/common/policies/policy.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AbilityFactory } from "./ability.factory";
import { CHECK_POLICY_KEY, PolicyHandler } from "./check-policy.decorator";
import { DomainError } from "../errors/domain-error";

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private reflector: Reflector, private factory: AbilityFactory) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) return true; // public route — AuthGuard already decided
    req.ability = this.factory.for(req.user);
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICY_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (handlers.some((h) => !h(req.ability))) {
      throw new DomainError("FORBIDDEN_ROLE", "Your role cannot perform this action", 403);
    }
    return true;
  }
}
```

`policies.module.ts` — `@Global()`, provides+exports `AbilityFactory`, provides `{ provide: APP_GUARD, useClass: PolicyGuard }`. Import into `AppModule` after `UsersModule` (guard order: Auth → Consent → Policy).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter api test -- ability.factory` → 5 PASS; full suite still green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/policies apps/api/package.json pnpm-lock.yaml apps/api/src/app.module.ts
git commit -m "feat(api): CASL ability factory + policy guard (FR-007)"
```

---

### Task 5: Users module — profile, DPA rights, admin suspension (FR-011, FR-013, FR-014)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (+`DataRequest`, `AuditLog` — new migration `add-data-requests-audit-log`), `apps/api/src/modules/users/users.module.ts`, `apps/api/src/modules/auth/auth.guard.ts` (suspended check), `apps/api/src/modules/auth/auth.controller.ts` (remove Phase 0's temporary `/users/me`)
- Create: `apps/api/src/modules/users/users.controller.ts`, `users.service.ts`, `apps/api/src/modules/users/dpa.processor.ts`, `apps/api/src/common/audit/audit.service.ts`, `apps/api/src/common/storage/storage.port.ts`, `apps/api/src/common/storage/fs-storage.adapter.ts`, `apps/api/src/common/queue/queue.module.ts`
- Test: `apps/api/test/users.e2e-spec.ts`, `apps/api/src/modules/users/dpa.processor.spec.ts`

**Interfaces:**
- Consumes: `ZodValidationPipe` (Task 3), `AbilityFactory` (Task 4), `profileUpdateSchema`/`userStatusUpdateSchema` (Task 2), `REDIS_URL` (Phase 0 Task 4).
- Produces:
  - Endpoints: `GET /users/me`, `PATCH /users/me`, `POST /users/me/data-export`, `POST /users/me/deletion-request`, `PATCH /users/:id/status` (ADMIN)
  - `AuditService.record(actorUserId, action, entityType, entityId, before, after)` — used by every later phase's sensitive writes
  - `StoragePort { putObject(path, data, contentType): Promise<{ publicUrl }>; createUploadUrl(path, contentType): Promise<{ uploadUrl; publicUrl; expiresAt }>; createDownloadUrl(path, expiresSeconds): Promise<string> }`, DI token `STORAGE_PORT`; `FsStorageAdapter` (dev/test) writes under `apps/api/.storage/`
  - BullMQ queue `"dpa"` with jobs `dpa.export` / `dpa.erasure`, payload `{ dataRequestId: string }`
  - `AuthGuard` now rejects `status: SUSPENDED` users with `FORBIDDEN_ROLE` 403

- [ ] **Step 1: Extend schema and migrate**

Append to `prisma/schema.prisma`:
```prisma
enum DataRequestType { EXPORT ERASURE }
enum DataRequestStatus { PENDING PROCESSING DONE FAILED }

model DataRequest {
  id          String            @id @default(uuid()) @db.Uuid
  userId      String            @map("user_id") @db.Uuid
  user        User              @relation(fields: [userId], references: [id])
  type        DataRequestType
  status      DataRequestStatus @default(PENDING)
  requestedAt DateTime          @default(now()) @map("requested_at")
  completedAt DateTime?         @map("completed_at")
  resultUrl   String?           @map("result_url")
  @@map("data_requests")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  actorUserId String   @map("actor_user_id") @db.Uuid
  action      String
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  before      Json?
  after       Json?
  createdAt   DateTime @default(now()) @map("created_at")
  @@index([entityType, entityId, createdAt(sort: Desc)])
  @@map("audit_log")
}
```
Add `dataRequests DataRequest[]` to `User`. Run: `cd apps/api && pnpm prisma migrate dev --name add-data-requests-audit-log`.

- [ ] **Step 2: Add queue infrastructure**

Run: `pnpm --filter api add @nestjs/bullmq bullmq`
`src/common/queue/queue.module.ts`:
```typescript
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: process.env.REDIS_URL } }),
    BullModule.registerQueue({ name: "dpa" }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

`src/common/storage/storage.port.ts`:
```typescript
export interface StoragePort {
  putObject(path: string, data: Buffer, contentType: string): Promise<{ publicUrl: string }>;
  createUploadUrl(path: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string; expiresAt: string }>;
  createDownloadUrl(path: string, expiresSeconds: number): Promise<string>;
}
export const STORAGE_PORT = Symbol("STORAGE_PORT");
```

`src/common/storage/fs-storage.adapter.ts` (dev/test; Firebase adapter replaces the binding in Task 7 for non-test envs):
```typescript
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { StoragePort } from "./storage.port";

const ROOT = join(process.cwd(), ".storage");

export class FsStorageAdapter implements StoragePort {
  async putObject(path: string, data: Buffer) {
    const full = join(ROOT, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    return { publicUrl: `file://${full}` };
  }
  async createUploadUrl(path: string) {
    const full = join(ROOT, path);
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return { uploadUrl: `file://${full}?upload`, publicUrl: `file://${full}`, expiresAt };
  }
  async createDownloadUrl(path: string) { return `file://${join(ROOT, path)}`; }
}
```
Add `.storage/` to `.gitignore`.

- [ ] **Step 3: Write the failing DPA processor unit test**

`src/modules/users/dpa.processor.spec.ts`:
```typescript
import { DpaProcessor } from "./dpa.processor";

describe("DpaProcessor", () => {
  const user = { id: "u1", name: "Juan", mobile: "+639170000001", email: null, vehicles: [{ plateNo: "ABA1234" }], consents: [] };
  const prisma: any = {
    dataRequest: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "dr1", userId: "u1", type: "EXPORT" }), update: jest.fn() },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(user), update: jest.fn() },
  };
  const storage: any = { putObject: jest.fn().mockResolvedValue({ publicUrl: "file:///x/export.json" }), createDownloadUrl: jest.fn().mockResolvedValue("file:///x/export.json") };

  it("export job dumps the user's rows as parseable JSON and stores the result URL", async () => {
    const p = new DpaProcessor(prisma, storage);
    await p.process({ name: "dpa.export", data: { dataRequestId: "dr1" } } as any);
    const [, buf] = storage.putObject.mock.calls[0];
    const parsed = JSON.parse(buf.toString("utf8"));
    expect(parsed.user.mobile).toBe("+639170000001");
    expect(parsed.user.vehicles[0].plateNo).toBe("ABA1234");
    expect(prisma.dataRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "dr1" },
      data: expect.objectContaining({ status: "DONE", resultUrl: "file:///x/export.json" }),
    }));
  });

  it("erasure job marks the user for the 30-day anonymize pass", async () => {
    prisma.dataRequest.findUniqueOrThrow.mockResolvedValue({ id: "dr2", userId: "u1", type: "ERASURE" });
    const p = new DpaProcessor(prisma, storage);
    await p.process({ name: "dpa.erasure", data: { dataRequestId: "dr2" } } as any);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({ erasureRequestedAt: expect.any(Date) }),
    }));
  });
});
```

Run: `pnpm --filter api test -- dpa.processor` → FAIL.

- [ ] **Step 4: Implement processor, audit service, users module**

`src/common/audit/audit.service.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../modules/prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  record(actorUserId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
    return this.prisma.auditLog.create({
      data: { actorUserId, action, entityType, entityId, before: before as any, after: after as any },
    });
  }
}
```

`src/modules/users/dpa.processor.ts`:
```typescript
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";

@Processor("dpa")
export class DpaProcessor extends WorkerHost {
  constructor(private prisma: PrismaService, @Inject(STORAGE_PORT) private storage: StoragePort) { super(); }

  async process(job: Job<{ dataRequestId: string }>) {
    const req = await this.prisma.dataRequest.findUniqueOrThrow({ where: { id: job.data.dataRequestId } });
    if (job.name === "dpa.export") {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: req.userId },
        include: { vehicles: { include: { odometerReadings: true } }, consents: true, dataRequests: true },
      });
      const body = Buffer.from(JSON.stringify({ exportedAt: new Date().toISOString(), user }, null, 2));
      const path = `dpa-exports/${req.userId}/${req.id}.json`;
      await this.storage.putObject(path, body, "application/json");
      const resultUrl = await this.storage.createDownloadUrl(path, 7 * 24 * 3600); // 7-day expiry
      await this.prisma.dataRequest.update({ where: { id: req.id }, data: { status: "DONE", completedAt: new Date(), resultUrl } });
    } else if (job.name === "dpa.erasure") {
      // Anonymize-not-delete (Data Model §8.6): mark now; the scheduled 30-day pass (Phase 7 job) strips PII.
      await this.prisma.user.update({ where: { id: req.userId }, data: { erasureRequestedAt: new Date() } });
      await this.prisma.dataRequest.update({ where: { id: req.id }, data: { status: "DONE", completedAt: new Date() } });
    }
  }
}
```

`src/modules/users/users.service.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { ProfileUpdate, UserStatusUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { DomainError } from "../../common/errors/domain-error";

const PROFILE_SELECT = { id: true, firebaseUid: true, name: true, mobile: true, email: true, role: true,
  address: true, emergencyContactName: true, emergencyContactMobile: true, orgId: true, status: true } as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService, @InjectQueue("dpa") private dpaQueue: Queue) {}

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_SELECT });
  }
  updateMe(userId: string, dto: ProfileUpdate) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: PROFILE_SELECT });
  }
  async createDataRequest(userId: string, type: "EXPORT" | "ERASURE") {
    const req = await this.prisma.dataRequest.create({ data: { userId, type } });
    await this.dpaQueue.add(type === "EXPORT" ? "dpa.export" : "dpa.erasure", { dataRequestId: req.id });
    return { requestId: req.id, status: req.status, requestedAt: req.requestedAt.toISOString() };
  }
  async setStatus(actorId: string, targetUserId: string, dto: UserStatusUpdate) {
    const before = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { status: true } });
    if (!before) throw new DomainError("FORBIDDEN_ROLE", "No such user", 404);
    const after = await this.prisma.user.update({ where: { id: targetUserId }, data: { status: dto.status }, select: PROFILE_SELECT });
    await this.audit.record(actorId, `user.status.${dto.status.toLowerCase()}:${dto.reason}`, "User", targetUserId, before, { status: after.status });
    return after;
  }
}
```

`src/modules/users/users.controller.ts`:
```typescript
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { profileUpdateSchema, userStatusUpdateSchema, ProfileUpdate, UserStatusUpdate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CheckPolicy } from "../../common/policies/check-policy.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private users: UsersService) {}

  @Get("me") me(@CurrentUser() u: { id: string }) { return this.users.me(u.id); }

  @Patch("me")
  updateMe(@CurrentUser() u: { id: string }, @Body(new ZodValidationPipe(profileUpdateSchema)) dto: ProfileUpdate) {
    return this.users.updateMe(u.id, dto);
  }

  @Post("me/data-export")
  dataExport(@CurrentUser() u: { id: string }) { return this.users.createDataRequest(u.id, "EXPORT"); }

  @Post("me/deletion-request")
  deletionRequest(@CurrentUser() u: { id: string }) { return this.users.createDataRequest(u.id, "ERASURE"); }

  @Patch(":id/status")
  @CheckPolicy((a) => a.can("update", "User"))
  setStatus(@CurrentUser() u: { id: string }, @Param("id") id: string,
            @Body(new ZodValidationPipe(userStatusUpdateSchema)) dto: UserStatusUpdate) {
    return this.users.setStatus(u.id, id, dto);
  }
}
```

Update `users.module.ts`: imports `QueueModule`; controllers `[ConsentController, UsersController]`; providers add `UsersService`, `AuditService`, `DpaProcessor`, `{ provide: STORAGE_PORT, useClass: FsStorageAdapter }` (export `AuditService` and `STORAGE_PORT`). Remove the temporary `/users/me` route from Phase 0's `auth.controller.ts`.

In `auth.guard.ts`, after loading the user add:
```typescript
    if (user.status === "SUSPENDED") throw new DomainError("FORBIDDEN_ROLE", "Account suspended", 403);
```

- [ ] **Step 5: Write the failing e2e test**

`test/users.e2e-spec.ts` (FirebaseService override maps token string → uid so we can act as three users; seed an ADMIN and a consented MEMBER directly via Prisma in `beforeAll`):
```typescript
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("users (e2e)", () => {
  let app: any, prisma: PrismaService, memberId: string;
  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => ({ uid: t }) }) // token IS the uid in tests
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: { firebaseUid: "admin-uid", role: "ADMIN", name: "Admin" } });
    const m = await prisma.user.create({
      data: { firebaseUid: "member-uid", role: "MEMBER",
              consents: { create: { policyVersion: "2026-08-privacy-v1" } } },
    });
    memberId = m.id;
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entityId: memberId } });
    await prisma.dataRequest.deleteMany({ where: { userId: memberId } });
    await prisma.consentRecord.deleteMany({ where: { userId: memberId } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: ["admin-uid", "member-uid"] } } });
    await app.close();
  });
  const as = (uid: string) => ({ get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`),
    patch: (p: string) => request(app.getHttpServer()).patch(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`),
    post: (p: string) => request(app.getHttpServer()).post(`/api/v1${p}`).set("Authorization", `Bearer ${uid}`) });

  it("member updates profile (FR-011)", async () => {
    const res = await as("member-uid").patch("/users/me").send({ name: "Juan", address: "Tetuan, Zamboanga City" }).expect(200);
    expect(res.body.data.address).toBe("Tetuan, Zamboanga City");
  });
  it("member cannot suspend anyone; admin can, with audit row (FR-014)", async () => {
    await as("member-uid").patch(`/users/${memberId}/status`).send({ status: "SUSPENDED", reason: "self-harm?" }).expect(403);
    const res = await as("admin-uid").patch(`/users/${memberId}/status`).send({ status: "SUSPENDED", reason: "test suspension" }).expect(200);
    expect(res.body.data.status).toBe("SUSPENDED");
    const audit = await prisma.auditLog.findFirst({ where: { entityType: "User", entityId: memberId } });
    expect(audit?.action).toContain("test suspension");
  });
  it("suspended member's token is rejected everywhere", async () => {
    const res = await as("member-uid").get("/users/me").expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    await as("admin-uid").patch(`/users/${memberId}/status`).send({ status: "ACTIVE", reason: "test done" }).expect(200);
  });
  it("data-export creates a PENDING DataRequest and enqueues (FR-013)", async () => {
    const res = await as("member-uid").post("/users/me/data-export").expect(201);
    expect(res.body.data.status).toBe("PENDING");
    const row = await prisma.dataRequest.findUnique({ where: { id: res.body.data.requestId } });
    expect(row?.type).toBe("EXPORT");
  });
});
```

Run: `pnpm --filter api test -- users.e2e` → FAIL, then verify implementation from Step 4 makes it PASS (fix wiring until green). Also run `pnpm --filter api test -- dpa.processor` → PASS now.

- [ ] **Step 6: Run the full suite**

Run: `pnpm --filter api test` → all green (Phase 0 auth e2e must be updated where it asserted the temporary `/users/me` — it now lives in UsersModule but the assertion `.expect(401)` for anonymous access still holds).

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat(api): users module — profile, DPA export/erasure jobs, admin suspension with audit (FR-011,013,014)"
```

---

### Task 6: Vehicles module (FR-003→FR-006, FR-048)

**Files:**
- Create: `apps/api/src/modules/vehicles/vehicles.module.ts`, `vehicles.controller.ts`, `vehicles.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/vehicles.e2e-spec.ts`

**Interfaces:**
- Consumes: `vehicleCreateSchema`/`vehicleUpdateSchema`/`odometerCreateSchema` (Task 2), `AbilityFactory` + `subject` (Task 4), `DomainError`, `PrismaService`.
- Produces: `GET/POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id` (DELETE archives), `POST /vehicles/:id/odometer`. Response rows use the `vehicleSchema` field set. Task 7 (uploads) and Phase 2+ consume `VehiclesService.findForUser(user, id)` — loads the row and throws 403 unless `ability.can(action, subject("Vehicle", row))`.

- [ ] **Step 1: Write the failing e2e test**

`test/vehicles.e2e-spec.ts` (same token-is-uid Firebase override as Task 5; seed consented member A, consented member B, and a MECHANIC):
```typescript
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("vehicles (e2e)", () => {
  let app: any, prisma: PrismaService, vehicleId: string;
  beforeAll(async () => {
    process.env.POLICY_VERSION = "2026-08-privacy-v1";
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
    prisma = app.get(PrismaService);
    for (const [uid, role] of [["veh-a", "MEMBER"], ["veh-b", "MEMBER"], ["veh-mech", "MECHANIC"]] as const) {
      await prisma.user.create({ data: { firebaseUid: uid, role,
        consents: role === "MEMBER" ? { create: { policyVersion: "2026-08-privacy-v1" } } : undefined } });
    }
  });
  afterAll(async () => {
    await prisma.odometerReading.deleteMany({ where: { vehicle: { plateNo: { in: ["XYZ7890"] } } } });
    await prisma.vehicle.deleteMany({ where: { plateNo: "XYZ7890" } });
    await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { in: ["veh-a", "veh-b"] } } } });
    await prisma.user.deleteMany({ where: { firebaseUid: { in: ["veh-a", "veh-b", "veh-mech"] } } });
    await app.close();
  });
  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);
  const body = { plateNo: "XYZ 7890", make: "Honda", model: "City", year: 2021, fuelType: "GASOLINE", transmission: "CVT", odometerKm: 15000 };

  it("creates a vehicle with normalized plate and initial odometer reading (FR-003/004)", async () => {
    const res = await as("veh-a").post("/api/v1/vehicles").send(body).expect(201);
    vehicleId = res.body.data.id;
    expect(res.body.data.plateNo).toBe("XYZ7890");
    expect(res.body.data.currentOdometerKm).toBe(15000);
  });
  it("rejects a duplicate plate with 409 PLATE_ALREADY_REGISTERED (FR-005)", async () => {
    const res = await as("veh-b").post("/api/v1/vehicles").send(body).expect(409);
    expect(res.body.error.code).toBe("PLATE_ALREADY_REGISTERED");
  });
  it("rejects an invalid plate with 400", async () => {
    await as("veh-a").post("/api/v1/vehicles").send({ ...body, plateNo: "1234ABC" }).expect(400);
  });
  it("another member cannot read or update it", async () => {
    await as("veh-b").get(`/api/v1/vehicles/${vehicleId}`).expect(403);
    await as("veh-b").patch(`/api/v1/vehicles/${vehicleId}`).send({ color: "red" }).expect(403);
  });
  it("staff can read but not update (FR-007)", async () => {
    await as("veh-mech").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
    await as("veh-mech").patch(`/api/v1/vehicles/${vehicleId}`).send({ color: "red" }).expect(403);
  });
  it("odometer regression is 422 without justification, accepted with one (FR-048, NFR-056)", async () => {
    const r1 = await as("veh-a").post(`/api/v1/vehicles/${vehicleId}/odometer`).send({ km: 14000 }).expect(422);
    expect(r1.body.error.code).toBe("ODOMETER_REGRESSION");
    await as("veh-a").post(`/api/v1/vehicles/${vehicleId}/odometer`).send({ km: 14000, justification: "odometer cluster replaced" }).expect(201);
    const v = await as("veh-a").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
    expect(v.body.data.currentOdometerKm).toBe(14000);
  });
  it("DELETE archives; archived is absent from list but staff still GET it (FR-006 note)", async () => {
    await as("veh-a").del(`/api/v1/vehicles/${vehicleId}`).expect(200);
    const list = await as("veh-a").get("/api/v1/vehicles").expect(200);
    expect(list.body.data.find((v: any) => v.id === vehicleId)).toBeUndefined();
    await as("veh-mech").get(`/api/v1/vehicles/${vehicleId}`).expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- vehicles.e2e` → FAIL (no routes, 404s).

- [ ] **Step 3: Implement service and controller**

`src/modules/vehicles/vehicles.service.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { subject } from "@casl/ability";
import type { OdometerCreate, VehicleCreate, VehicleUpdate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityFactory, AbilityUser, Action } from "../../common/policies/ability.factory";

const VEHICLE_SELECT = { id: true, plateNo: true, make: true, model: true, year: true, variant: true,
  engineCc: true, fuelType: true, transmission: true, color: true, vin: true, photoUrls: true,
  orCrUrls: true, currentOdometerKm: true, status: true, ownerUserId: true, orgOwnerId: true } as const;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService, private abilities: AbilityFactory) {}

  async list(user: AbilityUser) {
    if (user.role === "FLEET_MANAGER" && !user.orgId) return []; // fleet manager not yet attached to an org
    const owner = user.role === "FLEET_MANAGER" ? { orgOwnerId: user.orgId } : { ownerUserId: user.id };
    return this.prisma.vehicle.findMany({ where: { ...owner, status: "ACTIVE" }, select: VEHICLE_SELECT, orderBy: { createdAt: "asc" } });
  }

  async create(user: AbilityUser, dto: VehicleCreate) {
    const { odometerKm, ...fields } = dto;
    const owner = user.role === "FLEET_MANAGER"
      ? { orgOwnerId: user.orgId ?? undefined }
      : { ownerUserId: user.id };
    try {
      return await this.prisma.vehicle.create({
        data: { ...fields, ...owner, currentOdometerKm: odometerKm,
                odometerReadings: { create: { km: odometerKm, source: "MEMBER", recordedBy: user.id } } },
        select: VEHICLE_SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new DomainError("PLATE_ALREADY_REGISTERED", `Plate ${dto.plateNo} is already registered`, 409);
      throw e;
    }
  }

  /** Loads the row and enforces row-level ability — reused by uploads (Task 7) and later phases. */
  async findForUser(user: AbilityUser, id: string, action: Action = "read") {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT });
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "Vehicle not found", 404);
    if (!this.abilities.for(user).can(action, subject("Vehicle", vehicle)))
      throw new DomainError("FORBIDDEN_ROLE", "You cannot access this vehicle", 403);
    return vehicle;
  }

  async update(user: AbilityUser, id: string, dto: VehicleUpdate) {
    await this.findForUser(user, id, "update");
    return this.prisma.vehicle.update({ where: { id }, data: dto, select: VEHICLE_SELECT });
  }

  async archive(user: AbilityUser, id: string) {
    await this.findForUser(user, id, "delete");
    return this.prisma.vehicle.update({ where: { id }, data: { status: "ARCHIVED" }, select: VEHICLE_SELECT });
  }

  async recordOdometer(user: AbilityUser, id: string, dto: OdometerCreate) {
    const vehicle = await this.findForUser(user, id, "update");
    if (dto.km < vehicle.currentOdometerKm && !dto.justification)
      throw new DomainError("ODOMETER_REGRESSION", `Reading ${dto.km} km is below the current ${vehicle.currentOdometerKm} km — add a justification`, 422);
    const [reading] = await this.prisma.$transaction([
      this.prisma.odometerReading.create({ data: { vehicleId: id, km: dto.km, source: "MEMBER", recordedBy: user.id, justification: dto.justification } }),
      this.prisma.vehicle.update({ where: { id }, data: { currentOdometerKm: dto.km } }),
    ]);
    return { id: reading.id, km: reading.km, recordedAt: reading.recordedAt.toISOString() };
  }
}
```

`src/modules/vehicles/vehicles.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { odometerCreateSchema, vehicleCreateSchema, vehicleUpdateSchema,
         OdometerCreate, VehicleCreate, VehicleUpdate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "./vehicles.service";

@Controller("vehicles")
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Get() list(@CurrentUser() u: AbilityUser) { return this.vehicles.list(u); }

  @Post()
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(vehicleCreateSchema)) dto: VehicleCreate) {
    return this.vehicles.create(u, dto);
  }

  @Get(":id") get(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.vehicles.findForUser(u, id); }

  @Patch(":id")
  update(@CurrentUser() u: AbilityUser, @Param("id") id: string,
         @Body(new ZodValidationPipe(vehicleUpdateSchema)) dto: VehicleUpdate) {
    return this.vehicles.update(u, id, dto);
  }

  @Delete(":id") archive(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.vehicles.archive(u, id); }

  @Post(":id/odometer")
  odometer(@CurrentUser() u: AbilityUser, @Param("id") id: string,
           @Body(new ZodValidationPipe(odometerCreateSchema)) dto: OdometerCreate) {
    return this.vehicles.recordOdometer(u, id, dto);
  }
}
```

`vehicles.module.ts` declares both, exports `VehiclesService`; import into `AppModule`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- vehicles.e2e` → 7 PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): vehicles module — CRUD, archive, monotonic odometer (FR-003..006, FR-048)"
```

---

### Task 7: Photo upload path — signed URLs behind StoragePort (FR-006)

**Files:**
- Create: `apps/api/src/modules/uploads/uploads.module.ts`, `uploads.controller.ts`, `apps/api/src/common/storage/supabase-storage.adapter.ts`
- Modify: `apps/api/src/config/env.ts` (+`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`), `.env.example`, CI env, `apps/api/src/modules/users/users.module.ts` (storage provider becomes env-switched)
- Test: `apps/api/src/modules/uploads/uploads.controller.spec.ts`

**Interfaces:**
- Consumes: `STORAGE_PORT`/`StoragePort` (Task 5), `VehiclesService.findForUser` (Task 6). No Firebase coupling — storage is now Supabase, reached with the service-role key that lives only in the API env (Architecture §7.3 rule 2).
- Produces: `POST /uploads/signed-url` body `{ vehicleId: string, contentType: "image/jpeg" | "image/png", kind: "PHOTO" | "ORCR" }` → `{ uploadUrl, path, expiresAt }`, object path `vehicles/{vehicleId}/{uuid}.{jpg|png}`; `SupabaseStorageAdapter` bound when `NODE_ENV` ≠ `test`. Client flow: get URL → PUT the bytes (≤ 5 MB, enforced client-side and by a bucket file-size limit) → `PATCH /vehicles/:id` with the new `photoPaths`/`orCrPaths`.

> **Note — no public URLs.** The bucket is private, so the adapter returns an object *path*, not a durable public link. Rendering a stored image means calling `createDownloadUrl(path, ttl)` through `POST /uploads/download-url`, which runs the same CASL check as a database read (Architecture §7.3 rule 6). Persist paths in `photoPaths`/`orCrPaths`; never persist a signed URL — it expires.

- [ ] **Step 1: Write the failing controller unit test**

`src/modules/uploads/uploads.controller.spec.ts`:
```typescript
import { UploadsController } from "./uploads.controller";

describe("UploadsController", () => {
  const storage: any = { createUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: "https://up", publicUrl: "https://pub/x.jpg", expiresAt: "2026-01-01T00:00:00Z" }) };
  const vehicles: any = { findForUser: jest.fn().mockResolvedValue({ id: "v1" }) };
  const user = { id: "u1", role: "MEMBER" as const, orgId: null };
  const ctl = new UploadsController(storage, vehicles);

  it("returns a signed url under the vehicle's path for jpeg", async () => {
    const out = await ctl.signedUrl(user, { vehicleId: "v1", contentType: "image/jpeg", kind: "PHOTO" });
    expect(out.uploadUrl).toBe("https://up");
    expect(storage.createUploadUrl.mock.calls[0][0]).toMatch(/^vehicles\/v1\/[0-9a-f-]{36}\.jpg$/);
    expect(vehicles.findForUser).toHaveBeenCalledWith(user, "v1", "update"); // ownership enforced
  });
  it("rejects a disallowed content type", async () => {
    await expect(ctl.signedUrl(user, { vehicleId: "v1", contentType: "application/pdf" as any, kind: "PHOTO" })).rejects.toThrow();
  });
});
```

Run: `pnpm --filter api test -- uploads` → FAIL.

- [ ] **Step 2: Implement controller and adapter**

`src/modules/uploads/uploads.controller.ts`:
```typescript
import { Body, Controller, Inject, Post } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";

export const signedUrlSchema = z.object({
  vehicleId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png"]),
  kind: z.enum(["PHOTO", "ORCR"]),
});
const EXT = { "image/jpeg": "jpg", "image/png": "png" } as const;

@Controller("uploads")
export class UploadsController {
  constructor(@Inject(STORAGE_PORT) private storage: StoragePort, private vehicles: VehiclesService) {}

  @Post("signed-url")
  async signedUrl(@CurrentUser() user: AbilityUser,
                  @Body(new ZodValidationPipe(signedUrlSchema)) body: z.infer<typeof signedUrlSchema>) {
    await this.vehicles.findForUser(user, body.vehicleId, "update"); // owner or admin only
    const path = `vehicles/${body.vehicleId}/${randomUUID()}.${EXT[body.contentType]}`;
    return this.storage.createUploadUrl(path, body.contentType);
  }
}
```
Note: the unit test constructs the controller directly, so validate inside too — call `signedUrlSchema.parse(body)` as the first line (the pipe already did it on the HTTP path; double-parsing is harmless and keeps the unit test honest).

`src/common/storage/supabase-storage.adapter.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StoragePort } from "./storage.port";
import { loadEnv } from "../../config/env";

const UPLOAD_TTL_S = 15 * 60;

@Injectable()
export class SupabaseStorageAdapter implements StoragePort {
  private client: SupabaseClient;
  private bucketName: string;

  constructor() {
    const env = loadEnv();
    // Service-role key — server-side only. Never ship this to a client bundle.
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucketName = env.SUPABASE_STORAGE_BUCKET;
  }
  private bucket() { return this.client.storage.from(this.bucketName); }

  async putObject(path: string, data: Buffer, contentType: string) {
    const { error } = await this.bucket().upload(path, data, { contentType, upsert: false });
    if (error) throw error;
    return { path };
  }
  async createUploadUrl(path: string, _contentType: string) {
    const { data, error } = await this.bucket().createSignedUploadUrl(path);
    if (error) throw error;
    return {
      uploadUrl: data.signedUrl,
      path,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_S * 1000).toISOString(),
    };
  }
  async createDownloadUrl(path: string, expiresSeconds: number) {
    const { data, error } = await this.bucket().createSignedUrl(path, expiresSeconds);
    if (error) throw error;
    return data.signedUrl;
  }
}
```

> **Why `path` and not `publicUrl`.** The Firebase adapter could return a stable `storage.googleapis.com` URL because the bucket was world-readable behind an unguessable name. A private Supabase bucket has no such URL — every read is signed and expiring. The `StoragePort` return type changes from `{ publicUrl }` to `{ path }` accordingly, and callers that used to embed a URL must call `createDownloadUrl` at render time instead.

Switch the binding in `users.module.ts` (single source of truth for `STORAGE_PORT`):
```typescript
{ provide: STORAGE_PORT, useClass: process.env.NODE_ENV === "test" ? FsStorageAdapter : SupabaseStorageAdapter }
```
Add `SUPABASE_URL: z.string().url()`, `SUPABASE_SERVICE_ROLE_KEY: z.string()`, and `SUPABASE_STORAGE_BUCKET: z.string()` to `envSchema`; the matching entries to `.env.example` (`SUPABASE_STORAGE_BUCKET=autocare-media`); stub values to the CI env block. `uploads.module.ts` imports `VehiclesModule` and `UsersModule`; declare controller; import into `AppModule`.

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter api test -- uploads` → 2 PASS; full suite green.

- [ ] **Step 4: Manual verification against real Supabase Storage**

With real `.env` creds: `pnpm --filter api start:dev`, request a signed URL for a seeded vehicle (curl), then `curl -X PUT -H "Content-Type: image/jpeg" --data-binary @test.jpg "<uploadUrl>"`. Expected: 200 and the object visible in the Supabase dashboard under Storage. **Then confirm the negative case**: fetch the object's plain public URL and expect a failure — if it succeeds, the bucket is public and must be switched to private before this task is done. Record both outcomes in the PR.

- [ ] **Step 5: Commit**

```bash
git add apps/api .env.example .github
git commit -m "feat(api): signed-url uploads behind StoragePort with Supabase Storage adapter (FR-006)"
```

---

### Task 8: Member app — auth & consent flow (M-01→M-04)

**Files:**
- Modify: `apps/member/app.json`, `apps/member/package.json`, `apps/member/src/app/App.tsx`, `apps/member/src/shared/api.ts`
- Create: `apps/member/src/features/auth/firebaseAuth.ts`, `session.ts`, `OnboardingScreen.tsx`, `SignUpScreen.tsx`, `SignInScreen.tsx`, `VerifyEmailScreen.tsx`, `ConsentScreen.tsx`, `apps/member/src/app/RootNavigator.tsx`
- Test: `apps/member/src/features/auth/SignUpScreen.test.tsx`, `VerifyEmailScreen.test.tsx`, `session.test.ts`

**Interfaces:**
- Consumes: `theme` (Phase 0), `api` singleton, `sessionResponseSchema.consentRequired` (Task 3), `POST /auth/consent`.
- Produces: `firebaseAuth.ts` — `signUp(email, password): Promise<void>` (creates the account and sends the verification email), `signIn(email, password): Promise<void>`, `sendPasswordReset(email): Promise<void>` (FR-010), `reloadVerification(): Promise<boolean>`, `signInWithGoogle(): Promise<void>`, `currentIdToken(): Promise<string | null>`; `session.ts` — `bootstrap(): Promise<"ANONYMOUS" | "NEEDS_CONSENT" | "READY">` used by `RootNavigator` to pick the stack; SecureStore keys `firebase_id_token`, `last_active_at`. Task 9 hangs vehicle screens off the `READY` stack.

**Key decision (revised):** with phone auth dropped (Architecture §7.3a), the reCAPTCHA problem that forced `expo prebuild` disappears — **email/password works on the Firebase JS SDK inside Expo Go**, so a dev client is no longer required for auth alone. `@react-native-firebase/auth` via dev client remains an option if another native module forces prebuild later; decide on the basis of *those* modules, not this one. Verification emails land in a real inbox, so simulator/emulator testing needs no console test numbers — use a disposable address or the Firebase Auth emulator suite.

- [ ] **Step 1: Install native Firebase and prebuild**

```bash
pnpm --filter member add @react-native-firebase/app @react-native-firebase/auth @react-native-google-signin/google-signin expo-dev-client expo-build-properties
```
`app.json` additions:
```json
"plugins": ["@react-native-firebase/app", "@react-native-firebase/auth",
  ["expo-build-properties", { "ios": { "useFrameworks": "static" } }],
  "@react-native-google-signin/google-signin"],
"ios": { "supportsTablet": false, "bundleIdentifier": "ph.autocare.member", "googleServicesFile": "./GoogleService-Info.plist" }
```
Download `GoogleService-Info.plist` from the Firebase console into `apps/member/` (gitignore it; commit a `GoogleService-Info.example.plist` with placeholders). Run `pnpm --filter member exec expo prebuild -p ios && pnpm --filter member exec expo run:ios` — app must still boot to the Phase 0 login screen before proceeding.

- [ ] **Step 2: Write the failing session-policy + screen tests**

`src/features/auth/session.test.ts` (pure logic — no Firebase import):
```typescript
import { classifySession } from "./session";

describe("classifySession", () => {
  const now = new Date("2026-08-09T00:00:00Z").getTime();
  it("no token → ANONYMOUS", () => {
    expect(classifySession(null, null, now)).toBe("ANONYMOUS");
  });
  it("token idle over 30 days → ANONYMOUS (FR-015 groundwork, enforced in Task 12)", () => {
    const stale = String(now - 31 * 24 * 3600 * 1000);
    expect(classifySession("tok", stale, now)).toBe("ANONYMOUS");
  });
  it("fresh token → TOKEN_OK", () => {
    expect(classifySession("tok", String(now - 1000), now)).toBe("TOKEN_OK");
  });
});
```

`src/features/auth/SignUpScreen.test.tsx`:
```tsx
import { fireEvent, render } from "@testing-library/react-native";
import { SignUpScreen } from "./SignUpScreen";

describe("SignUpScreen", () => {
  it("disables Continue until email and password are both valid", () => {
    const { getByPlaceholderText, getByTestId } = render(<SignUpScreen onSubmit={jest.fn()} onGoogle={jest.fn()} />);
    expect(getByTestId("continue").props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "gab@example.com");
    expect(getByTestId("continue").props.accessibilityState.disabled).toBe(true); // password still empty
    fireEvent.changeText(getByPlaceholderText("At least 8 characters"), "hunter2!");
    expect(getByTestId("continue").props.accessibilityState.disabled).toBe(false);
  });
  it("rejects a malformed address without calling onSubmit", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByTestId } = render(<SignUpScreen onSubmit={onSubmit} onGoogle={jest.fn()} />);
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "gab@");
    fireEvent.changeText(getByPlaceholderText("At least 8 characters"), "hunter2!");
    fireEvent.press(getByTestId("continue"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it("submits a normalised, lower-cased address", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByTestId } = render(<SignUpScreen onSubmit={onSubmit} onGoogle={jest.fn()} />);
    fireEvent.changeText(getByPlaceholderText("you@example.com"), "  Gab@Example.COM ");
    fireEvent.changeText(getByPlaceholderText("At least 8 characters"), "hunter2!");
    fireEvent.press(getByTestId("continue"));
    expect(onSubmit).toHaveBeenCalledWith("gab@example.com", "hunter2!");
  });
});
```

`src/features/auth/VerifyEmailScreen.test.tsx`:
```tsx
import { act, fireEvent, render } from "@testing-library/react-native";
import { VerifyEmailScreen } from "./VerifyEmailScreen";

describe("VerifyEmailScreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("resend is locked for 60 s then enabled", () => {
    const { getByTestId } = render(<VerifyEmailScreen email="gab@example.com" onResend={jest.fn()} onRecheck={jest.fn()} />);
    expect(getByTestId("resend").props.accessibilityState.disabled).toBe(true);
    act(() => jest.advanceTimersByTime(60_000));
    expect(getByTestId("resend").props.accessibilityState.disabled).toBe(false);
  });
  it("caps resends at 3, then offers support (UC-001 alt 4a)", () => {
    const onResend = jest.fn();
    const { getByTestId, queryByTestId } = render(<VerifyEmailScreen email="gab@example.com" onResend={onResend} onRecheck={jest.fn()} />);
    for (let i = 0; i < 3; i++) {
      act(() => jest.advanceTimersByTime(60_000));
      fireEvent.press(getByTestId("resend"));
    }
    act(() => jest.advanceTimersByTime(60_000));
    expect(onResend).toHaveBeenCalledTimes(3);
    expect(getByTestId("resend").props.accessibilityState.disabled).toBe(true);
    expect(queryByTestId("contact-support")).not.toBeNull();
  });
  it("recheck polls verification state", () => {
    const onRecheck = jest.fn();
    const { getByTestId } = render(<VerifyEmailScreen email="gab@example.com" onResend={jest.fn()} onRecheck={onRecheck} />);
    fireEvent.press(getByTestId("recheck"));
    expect(onRecheck).toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter member test` → new tests FAIL.

- [ ] **Step 3: Implement auth service and screens**

`src/features/auth/firebaseAuth.ts`:
```typescript
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as SecureStore from "expo-secure-store";

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });

async function persistToken() {
  const token = await auth().currentUser?.getIdToken();
  if (token) {
    await SecureStore.setItemAsync("firebase_id_token", token);
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
  }
}

export async function signUp(email: string, password: string) {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  await cred.user.sendEmailVerification();
  await persistToken();
}

export async function signIn(email: string, password: string) {
  await auth().signInWithEmailAndPassword(email, password);
  await persistToken();
}

export async function sendPasswordReset(email: string) {
  await auth().sendPasswordResetEmail(email); // FR-010
}

export async function resendVerification() {
  await auth().currentUser?.sendEmailVerification();
}

/** Returns true once Firebase reports the address verified. Forces a token
 *  refresh so the API sees a fresh `email_verified` claim, not a cached one. */
export async function reloadVerification(): Promise<boolean> {
  const user = auth().currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  await persistToken();
  return true;
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const { data } = await GoogleSignin.signIn();
  const cred = auth.GoogleAuthProvider.credential(data?.idToken ?? null);
  await auth().signInWithCredential(cred);
  await persistToken();
}

export async function currentIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (user) { const t = await user.getIdToken(); await SecureStore.setItemAsync("firebase_id_token", t); return t; }
  return SecureStore.getItemAsync("firebase_id_token");
}

export async function signOut() {
  await auth().signOut().catch(() => {});
  await SecureStore.deleteItemAsync("firebase_id_token");
  await SecureStore.deleteItemAsync("last_active_at");
}
```
Add `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the member app's `.env` docs (value from the Firebase console's iOS/web OAuth client).

`src/features/auth/session.ts`:
```typescript
import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";
import { currentIdToken } from "./firebaseAuth";

const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

/** Pure, testable core: what does the stored state imply? */
export function classifySession(token: string | null, lastActiveAt: string | null, nowMs: number): "ANONYMOUS" | "TOKEN_OK" {
  if (!token) return "ANONYMOUS";
  if (!lastActiveAt || nowMs - Number(lastActiveAt) > THIRTY_DAYS_MS) return "ANONYMOUS"; // FR-015
  return "TOKEN_OK";
}

export type BootState = "ANONYMOUS" | "NEEDS_CONSENT" | "READY";

export async function bootstrap(): Promise<BootState> {
  const token = await currentIdToken();
  const lastActive = await SecureStore.getItemAsync("last_active_at");
  if (classifySession(token, lastActive, Date.now()) === "ANONYMOUS") return "ANONYMOUS";
  try {
    const session = await api.createSession();
    await SecureStore.setItemAsync("last_active_at", String(Date.now()));
    return session.consentRequired ? "NEEDS_CONSENT" : "READY";
  } catch { return "ANONYMOUS"; }
}
```

`SignUpScreen.tsx` (M-02) — presentational, logic injected so tests need no Firebase:
```tsx
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function SignUpScreen({ onSubmit, onGoogle }:
  { onSubmit: (email: string, password: string) => void; onGoogle: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const normalised = email.trim().toLowerCase();
  const valid = EMAIL.test(normalised) && password.length >= MIN_PASSWORD;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Create your account</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
        We'll email you a link to confirm it's you.
      </Text>
      <TextInput placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none"
        autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail}
        style={[theme.text("body"), { height: theme.minTarget, backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.sm, borderWidth: 1, borderColor: theme.colors.line,
          paddingHorizontal: theme.spacing.sm }]} testID="email-input" />
      <TextInput placeholder="At least 8 characters" secureTextEntry autoCapitalize="none"
        autoComplete="new-password" textContentType="newPassword" value={password} onChangeText={setPassword}
        style={[theme.text("body"), { height: theme.minTarget, backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.sm, borderWidth: 1, borderColor: theme.colors.line,
          paddingHorizontal: theme.spacing.sm, marginTop: theme.spacing.sm }]} testID="password-input" />
      <Pressable testID="continue" disabled={!valid} accessibilityState={{ disabled: !valid }}
        onPress={() => { if (valid) onSubmit(normalised, password); }}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, marginTop: theme.spacing.md,
                 backgroundColor: valid ? theme.colors.primary : theme.colors.line,
                 alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>Continue</Text>
      </Pressable>
      <Pressable onPress={onGoogle} testID="google"
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}>
        <Text style={[theme.text("body"), { color: theme.colors.primary }]}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}
```

Note the `if (valid)` guard inside `onPress` as well as the `disabled` prop — RTL's `fireEvent.press` fires regardless of `disabled`, and the "rejects a malformed address" test depends on the guard.

`SignInScreen.tsx` (M-02b) — the returning-member counterpart: same two fields with `autoComplete="current-password"`, a primary "Sign in" button wired to `signIn`, a "Forgot password?" link calling `sendPasswordReset(email)` (FR-010) that always shows the same "check your inbox" confirmation whether or not the address exists — never reveal account existence — and a link across to `SignUpScreen`.

`VerifyEmailScreen.tsx` (M-03):
```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "../../theme";

const MAX_RESENDS = 3;

export function VerifyEmailScreen({ email, onResend, onRecheck }:
  { email: string; onResend: () => void; onRecheck: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [resends, setResends] = useState(0);
  useEffect(() => {
    if (secondsLeft === 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft === 0]);
  const exhausted = resends >= MAX_RESENDS;
  const resendDisabled = secondsLeft > 0 || exhausted;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.chassis, padding: theme.spacing.lg, justifyContent: "center" }}>
      <Text style={[theme.text("h1"), { color: theme.colors.primaryDeep }]}>Check your inbox</Text>
      <Text style={[theme.text("body"), { color: theme.colors.inkMuted, marginBottom: theme.spacing.md }]}>
        We sent a confirmation link to {email}. Tap it, then come back here.
      </Text>
      <Pressable testID="recheck" onPress={onRecheck}
        style={{ height: theme.minTarget, borderRadius: theme.radii.sm, backgroundColor: theme.colors.primary,
                 alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.onPrimary, fontWeight: "600" }]}>I've confirmed it</Text>
      </Pressable>
      <Pressable testID="resend" disabled={resendDisabled} accessibilityState={{ disabled: resendDisabled }}
        onPress={() => { if (resendDisabled) return; onResend(); setResends((n) => n + 1); setSecondsLeft(60); }}
        style={{ height: theme.minTarget, alignItems: "center", justifyContent: "center", marginTop: theme.spacing.sm }}>
        <Text style={[theme.text("body"), { color: resendDisabled ? theme.colors.inkMuted : theme.colors.primary }]}>
          {exhausted ? "Resend limit reached" : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend email"}
        </Text>
      </Pressable>
      {exhausted && (
        <Text testID="contact-support" style={[theme.text("caption"), { color: theme.colors.inkMuted, textAlign: "center", marginTop: theme.spacing.sm }]}>
          Still nothing? Check spam, or contact support.
        </Text>
      )}
    </View>
  );
}
```

There is no deep-link handler to build: Firebase's verification link opens in the browser and marks the address verified server-side. The app finds out by polling — `onRecheck` calls `reloadVerification()`, which forces a token refresh so the API sees a fresh `email_verified` claim rather than a cached one.

`OnboardingScreen.tsx` (M-01): horizontal `FlatList` with `pagingEnabled`, 3 cards — ("Your car, always cared for", "Scheduled maintenance, pickup & delivery, roadside help — one subscription."), ("Know your car's health", "Every inspection produces a 0–100 Vehicle Health Score you can track and share."), ("Built for Zamboanga", "Local workshop, certified mechanics, service at your door.") — each card `bg-surface` rounded-md with display-type heading in `primaryDeep`; page dots; persistent "Get started" primary button (height `theme.minTarget`) that navigates to SignUp.

`ConsentScreen.tsx` (M-04): `ScrollView` of the privacy policy text (bundle `src/features/auth/privacy-policy.md` as a TS string constant `PRIVACY_POLICY` with the anonymize-not-delete clause stated plainly per Data Model §8.6); version label `Policy version {POLICY_VERSION}` in mono type from `process.env.EXPO_PUBLIC_POLICY_VERSION` (must match the API's `POLICY_VERSION`); "I agree" primary button pinned below, which calls `api.post("/auth/consent", { policyVersion })`, then `onConsented()`.

`RootNavigator.tsx`: on mount run `bootstrap()`; while pending show splash (chassis background, "AutoCare+" display type). `ANONYMOUS` → stack [Onboarding, SignUp, SignIn, VerifyEmail, Consent]; `NEEDS_CONSENT` → [Consent]; `READY` → Home stack (Task 9). Container screens wire the presentational screens to `signUp`/`signIn`/`resendVerification`/`reloadVerification`/`signInWithGoogle`; after Firebase sign-in succeeds call `api.createSession()`, then route: unverified email → VerifyEmail, else by `consentRequired`. Google sign-in arrives pre-verified and skips VerifyEmail entirely. `App.tsx` renders `RootNavigator`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter member test` → all PASS (Phase 0 theme tests included). Mock `expo-secure-store` and `./firebaseAuth` in jest config (`moduleNameMapper` or `jest.mock`) so unit tests never load native modules.

- [ ] **Step 5: Manual e2e on iOS simulator**

With the local API running (`docker compose up -d`, `pnpm --filter api start:dev`) and a disposable inbox to hand: `pnpm --filter member exec expo start`. Walk: onboarding → sign up with that address → open the verification email and tap the link → back in the app tap "I've confirmed it" → consent scroll + agree → (lands on Task 9's home once built; for now expect the READY placeholder). Then force-quit and relaunch → splash goes straight past login (token persisted). Also verify: Google sign-in with a real Google account skips the verify step; "Forgot password?" delivers a reset email and the new password works. Record each in the PR.

- [ ] **Step 6: Commit**

```bash
git add apps/member
git commit -m "feat(member): email/password + Google sign-in, email verification, DPA consent flow, session bootstrap (M-01..M-04)"
```

---

### Task 9: Member app — vehicles & home shell (M-05→M-07, M-11, M-12, M-34, M-35)

**Files:**
- Create: `apps/member/src/features/vehicles/AddVehicleScreen.tsx`, `VehiclePhotosScreen.tsx`, `VehiclesListScreen.tsx`, `VehicleDetailScreen.tsx`, `vehicleForm.ts`, `uploadPhoto.ts`, `apps/member/src/features/home/HomeScreen.tsx`, `apps/member/src/features/profile/ProfileScreen.tsx`, `PrivacyScreen.tsx`, `apps/member/src/app/HomeTabs.tsx`
- Modify: `apps/member/src/app/RootNavigator.tsx`
- Test: `apps/member/src/features/vehicles/vehicleForm.test.ts`, `AddVehicleScreen.test.tsx`

**Interfaces:**
- Consumes: `vehicleCreateSchema`, `fuelTypes`, `transmissions`, `Vehicle` from `@autocare/contracts` (client and server share the Zod schema); `api` (`get/post/patch/del`); `POST /uploads/signed-url` (Task 7).
- Produces: the `READY` stack — bottom tabs Home (M-11) / Vehicles (M-05) / Profile (M-34), with Add-Vehicle (M-06), Photos (M-07), Vehicle Detail shell (M-12), Privacy & data (M-35) pushed on top. First-run: a consented member with zero vehicles is deep-linked straight into AddVehicle.

- [ ] **Step 1: Write the failing form-logic tests**

`src/features/vehicles/vehicleForm.test.ts`:
```typescript
import { validateVehicleForm, emptyVehicleForm } from "./vehicleForm";

describe("vehicle form", () => {
  it("maps schema issues to per-field errors", () => {
    const r = validateVehicleForm({ ...emptyVehicleForm, plateNo: "1234ABC", year: "2019", odometerKm: "42000",
      make: "Toyota", model: "Vios", fuelType: "GASOLINE", transmission: "AT" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.plateNo).toMatch(/plate/i);
  });
  it("coerces numeric strings and returns a valid payload", () => {
    const r = validateVehicleForm({ ...emptyVehicleForm, plateNo: "ABA 1234", year: "2019", odometerKm: "42000",
      make: "Toyota", model: "Vios", fuelType: "GASOLINE", transmission: "AT" });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.data.plateNo).toBe("ABA1234"); expect(r.data.year).toBe(2019); }
  });
});
```

`src/features/vehicles/AddVehicleScreen.test.tsx`:
```tsx
import { fireEvent, render } from "@testing-library/react-native";
import { AddVehicleScreen } from "./AddVehicleScreen";

describe("AddVehicleScreen", () => {
  it("shows the plate error inline after an invalid submit", () => {
    const { getByTestId, getByText } = render(<AddVehicleScreen onCreated={jest.fn()} createVehicle={jest.fn()} />);
    fireEvent.changeText(getByTestId("field-plateNo"), "1234ABC");
    fireEvent.press(getByTestId("submit"));
    getByText(/not a valid ph plate/i);
  });
});
```

Run: `pnpm --filter member test` → FAIL.

- [ ] **Step 2: Implement form logic and screens**

`src/features/vehicles/vehicleForm.ts` (pure — shared schema does the real validation):
```typescript
import { vehicleCreateSchema, VehicleCreate } from "@autocare/contracts";

export interface VehicleFormState {
  plateNo: string; make: string; model: string; year: string; variant: string;
  engineCc: string; fuelType: string; transmission: string; odometerKm: string; color: string; vin: string;
}
export const emptyVehicleForm: VehicleFormState = { plateNo: "", make: "", model: "", year: "", variant: "",
  engineCc: "", fuelType: "GASOLINE", transmission: "AT", odometerKm: "", color: "", vin: "" };

export type FormResult = { ok: true; data: VehicleCreate } | { ok: false; errors: Partial<Record<keyof VehicleFormState, string>> };

export function validateVehicleForm(f: VehicleFormState): FormResult {
  const candidate = {
    plateNo: f.plateNo, make: f.make.trim(), model: f.model.trim(),
    year: Number(f.year) || 0,
    variant: f.variant.trim() || undefined,
    engineCc: f.engineCc ? Number(f.engineCc) : undefined,
    fuelType: f.fuelType, transmission: f.transmission,
    odometerKm: Number(f.odometerKm) || 0,
    color: f.color.trim() || undefined,
    vin: f.vin.trim() || undefined,
  };
  const parsed = vehicleCreateSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { ok: false, errors };
}
```

`AddVehicleScreen.tsx` (M-06): scrollable form on `chassis` — plate field first in **mono type, auto-uppercase** (`autoCapitalize="characters"`), then make/model/year/odometer (number-pad), fuel + transmission as segmented `Pressable` pill rows built from `fuelTypes`/`transmissions` (each pill ≥ `theme.minTarget` tall), optional collapsed "More details" section for variant/engineCc/color/vin. Each field `testID={"field-" + name}` with its error in `theme.colors.danger` label type beneath. Submit button "Add vehicle" calls `validateVehicleForm`; on `ok`, `props.createVehicle(data)` (the container passes `(d) => api.post("/vehicles", d)`); an `ApiError` with code `PLATE_ALREADY_REGISTERED` renders inline on the plate field ("This plate is already registered — contact support if it's yours"). On success → `onCreated(vehicle)` → Photos screen.

`uploadPhoto.ts`:
```typescript
import { api } from "../../shared/api";

export async function uploadVehiclePhoto(vehicleId: string, localUri: string, kind: "PHOTO" | "ORCR") {
  const contentType = localUri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
    "/uploads/signed-url", { vehicleId, contentType, kind });
  const blob = await (await fetch(localUri)).blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error("Photo is over 5 MB — retake at lower quality");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!put.ok) throw new Error("Upload failed — try again");
  return publicUrl;
}
```

`VehiclePhotosScreen.tsx` (M-07): `expo-image-picker` (add dep) grid — up to 6 vehicle photos + 2 OR/CR shots (`quality: 0.7` keeps files under 5 MB); each successful `uploadVehiclePhoto` appends to local state; "Done" PATCHes `/vehicles/:id` with `{ photoUrls, orCrUrls }`; "Skip for now" text button (photos optional per FR-006) — both land on Home.

`VehiclesListScreen.tsx` (M-05): `useEffect` fetch `api.get<Vehicle[]>("/vehicles")`; card per vehicle — plate in mono type on a `primaryDeep` chip, "{year} {make} {model}", odometer "42,000 km" in `inkMuted`; pull-to-refresh; floating "+" (min target) → AddVehicle; empty state illustration text "No vehicles yet — add your first" with primary CTA.

`VehicleDetailScreen.tsx` (M-12 shell): header photo (first `photoUrls` or placeholder swatch), plate chip, spec rows (fuel, transmission, variant, VIN in mono), odometer row with "Update" inline action posting to `/vehicles/:id/odometer` (on `ODOMETER_REGRESSION` show the justification prompt and retry with it), archive action in an overflow menu (confirm sheet: "Archive this vehicle? Its history is kept.") calling `api.del`. Reserve a clearly-labeled placeholder card "Health Score — coming with your first inspection" (Phase 4 fills it).

`HomeScreen.tsx` (M-11 shell): greeting "Magandang araw, {firstName}", primary card = first vehicle (plate chip + odometer), quick actions row (Add vehicle, Update odometer) — subscription/booking cards arrive Phases 2–3.

`ProfileScreen.tsx` (M-34): form bound to `GET/PATCH /users/me` via `profileUpdateSchema` (same per-field error mapping pattern as `vehicleForm`); sign-out row calling `signOut()` then resetting to ANONYMOUS. `PrivacyScreen.tsx` (M-35): policy text + version, "Download my data" → `POST /users/me/data-export` (confirmation toast "We'll prepare your export — check back in Profile"), "Delete my account" → confirm sheet stating the anonymize policy plainly, then `POST /users/me/deletion-request` and sign-out.

`HomeTabs.tsx`: `@react-navigation/bottom-tabs` (add dep) — Home/Vehicles/Profile, active tint `theme.colors.primary`, inactive `inkMuted`, 49pt bar + safe area. `RootNavigator` `READY` branch: if the vehicles fetch returns `[]` on first entry, push AddVehicle immediately (first-run flow).

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter member test` → PASS.

- [ ] **Step 4: Manual e2e — the phase's exit criterion**

Fresh simulator install → onboarding → sign up + email verification → consent → AddVehicle (`ABA 1234`, try `1234ABC` first to see the inline error) → photos from the simulator library → Home shows the vehicle → detail → odometer update → regression path shows justification prompt. Record a screen recording for the PR.

- [ ] **Step 5: Commit**

```bash
git add apps/member
git commit -m "feat(member): vehicle CRUD screens, photo upload, home tabs, profile & privacy (M-05..M-07,M-11,M-12,M-34,M-35)"
```

---

### Task 10: Web staff login (W-01, risk R-12)

**Files:**
- Create: `apps/web/lib/auth/firebase.ts`, `apps/web/lib/auth/session.ts`, `apps/web/app/api/session/route.ts`, `apps/web/app/staff/page.tsx`, `apps/web/app/admin/page.tsx` (placeholder landing), `apps/web/e2e/login.spec.ts`, `apps/web/playwright.config.ts`
- Modify: `apps/web/middleware.ts`, `apps/web/app/login/page.tsx`
- Test: `apps/web/lib/auth/session.test.ts`, `apps/web/middleware.test.ts`

**Interfaces:**
- Consumes: `POST /api/v1/auth/session` (API), `createApiClient`.
- Produces: `sealSession({ uid, role }): Promise<string>` / `openSession(cookie): Promise<{ uid, role } | null>` (jose `EncryptJWT`/`jwtDecrypt`, `dir` + `A256GCM`, secret = `SESSION_SECRET` (32+ chars), 12 h expiry); httpOnly cookie `ac_session`; middleware role-gates `/staff` (ADVISOR|MECHANIC|ADMIN) and `/admin` (ADMIN). Rules (Architecture §7.4a): ID token never touches localStorage; the Route Handler holds zero domain logic — it only verifies via the API and mints the cookie.

- [ ] **Step 1: Write the failing session + middleware tests**

`lib/auth/session.test.ts` (Vitest):
```typescript
import { describe, expect, it } from "vitest";
import { openSession, sealSession } from "./session";

process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";

describe("session cookie", () => {
  it("round-trips uid and role", async () => {
    const cookie = await sealSession({ uid: "u1", role: "ADMIN" });
    expect(await openSession(cookie)).toMatchObject({ uid: "u1", role: "ADMIN" });
  });
  it("returns null for garbage", async () => {
    expect(await openSession("not-a-jwe")).toBeNull();
  });
});
```

`middleware.test.ts`:
```typescript
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { sealSession } from "./lib/auth/session";

process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";
const req = (path: string, cookie?: string) => {
  const r = new NextRequest(`http://localhost:3000${path}`);
  if (cookie) r.cookies.set("ac_session", cookie);
  return r;
};

describe("middleware", () => {
  it("redirects anonymous /staff to /login", async () => {
    const res = await middleware(req("/staff"));
    expect(res?.headers.get("location")).toContain("/login");
  });
  it("blocks a MEMBER cookie from /admin", async () => {
    const res = await middleware(req("/admin", await sealSession({ uid: "u1", role: "MEMBER" })));
    expect(res?.headers.get("location")).toContain("/login");
  });
  it("lets an ADVISOR into /staff but not /admin", async () => {
    const cookie = await sealSession({ uid: "u2", role: "ADVISOR" });
    expect((await middleware(req("/staff", cookie)))?.headers.get("location")).toBeNull();
    expect((await middleware(req("/admin", cookie)))?.headers.get("location")).toContain("/login");
  });
  it("lets an ADMIN into both", async () => {
    const cookie = await sealSession({ uid: "u3", role: "ADMIN" });
    expect((await middleware(req("/admin", cookie)))?.headers.get("location")).toBeNull();
  });
});
```

Run: `pnpm --filter web test` → FAIL.

- [ ] **Step 2: Implement session sealing, route handler, middleware**

Run: `pnpm --filter web add firebase jose && pnpm --filter web add -D @playwright/test`
Env (`apps/web/.env.local.example` — create it): `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_API_URL=http://localhost:3001`, `SESSION_SECRET=` (32+ random chars).

`lib/auth/session.ts` (edge-safe — jose only):
```typescript
import { EncryptJWT, jwtDecrypt } from "jose";
import type { Role } from "@autocare/contracts";

export interface StaffSession { uid: string; role: Role }
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function sealSession(s: StaffSession): Promise<string> {
  return new EncryptJWT({ uid: s.uid, role: s.role })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt().setExpirationTime("12h")
    .encrypt(key());
}
export async function openSession(cookie: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtDecrypt(cookie, key());
    return { uid: payload.uid as string, role: payload.role as Role };
  } catch { return null; }
}
```

`lib/auth/firebase.ts`: client-side `initializeApp` from the `NEXT_PUBLIC_FIREBASE_*` vars, exports `signInStaff(email, password)` → `signInWithEmailAndPassword` → `getIdToken()` (held in memory only, passed straight to the route handler).

`app/api/session/route.ts` (zero domain logic — verify via API, mint cookie):
```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sealSession } from "../../../lib/auth/session";

export async function POST(req: Request) {
  const { idToken } = await req.json();
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`, {
    method: "POST", headers: { Authorization: `Bearer ${idToken}` },
  });
  const body = await upstream.json();
  if (!upstream.ok || !body.success) {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
  const { id, role } = body.data.user;
  if (role === "MEMBER" || role === "FLEET_MANAGER") {
    return NextResponse.json({ error: "staff_only" }, { status: 403 });
  }
  cookies().set("ac_session", await sealSession({ uid: id, role }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 12 * 3600, path: "/",
  });
  return NextResponse.json({ role });
}
export async function DELETE() {
  cookies().delete("ac_session");
  return NextResponse.json({ ok: true });
}
```

`middleware.ts` (replaces Phase 0's cookie-presence check):
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { openSession } from "./lib/auth/session";

const GATES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/staff", roles: ["ADVISOR", "MECHANIC", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const gate = GATES.find((g) => req.nextUrl.pathname.startsWith(g.prefix));
  if (!gate) return NextResponse.next();
  const cookie = req.cookies.get("ac_session")?.value;
  const session = cookie ? await openSession(cookie) : null;
  if (!session || !gate.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/staff/:path*", "/admin/:path*"] };
```

`app/login/page.tsx`: wire the Phase 0 form — on submit `signInStaff` → `fetch("/api/session", { method: "POST", body: JSON.stringify({ idToken }) })` → on `{ role }` redirect ADMIN→`/admin`, else `/staff`; error states "Wrong email or password" / "Staff access only. Members use the mobile app." in `danger` color. `app/staff/page.tsx` and `app/admin/page.tsx`: minimal landing ("Advisor console — Phase 3 fills this in" / "Admin — Phase 7") with a sign-out button (`fetch("/api/session", { method: "DELETE" })` → `/login`).

- [ ] **Step 3: Run unit tests**

Run: `pnpm --filter web test` → 6 PASS.

- [ ] **Step 4: Playwright smoke (R-12 closure)**

`playwright.config.ts`: `testDir: "e2e"`, `use: { baseURL: "http://localhost:3000" }`, `webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: true }`.
`e2e/login.spec.ts`:
```typescript
import { expect, test } from "@playwright/test";

const email = process.env.E2E_STAFF_EMAIL, password = process.env.E2E_STAFF_PASSWORD;
test.skip(!email || !password, "needs E2E_STAFF_EMAIL/PASSWORD and a running API");

test("staff signs in and lands on /staff", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/staff/);
});

test("anonymous /admin bounces to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
```
Add script `"e2e": "playwright test"`. Run against local API + a real Firebase staff account (create one email/password user in the console, then set their DB `role` to `ADVISOR` via `psql`): `E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… pnpm --filter web e2e` → 2 PASS. This closes R-12; record in the PR.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): staff login — Firebase sign-in, encrypted ac_session cookie, role-gated middleware (W-01, closes R-12)"
```

---

### Task 11: Field app staff login (F-01)

**Files:**
- Modify: `apps/field/src/features/auth/StaffLoginScreen.tsx`, `apps/field/src/app/App.tsx`, `apps/field/package.json`
- Create: `apps/field/src/features/auth/staffAuth.ts`, `apps/field/src/shared/api.ts` (mirror of member's if Phase 0 didn't create it)
- Test: `apps/field/src/features/auth/staffAuth.test.ts`

**Interfaces:**
- Consumes: Phase 0 `fieldTheme`, `createApiClient`; email/password works in the plain Firebase **JS** SDK on RN (no reCAPTCHA needed — no prebuild required for the field app this phase).
- Produces: `signInStaff(email, password): Promise<{ role: Role }>` — Firebase JS SDK `signInWithEmailAndPassword` → token into SecureStore `firebase_id_token` → `api.createSession()`; rejects MEMBER/FLEET_MANAGER roles with error message "This app is for AutoCare+ staff." App boots to StaffLogin when no valid token, else a "Signed in as {name} — {role}" placeholder home (Phase 3/4 build the real screens).

- [ ] **Step 1: Write the failing test**

Run: `pnpm --filter field add firebase expo-secure-store`
`src/features/auth/staffAuth.test.ts` (mock `firebase/auth` and the api client):
```typescript
import { signInStaff } from "./staffAuth";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { getIdToken: async () => "staff-token" } }),
}));
jest.mock("../../shared/api", () => ({ api: { createSession: jest.fn() } }));
import { api } from "../../shared/api";

describe("signInStaff", () => {
  it("stores the token and returns the role for staff", async () => {
    (api.createSession as jest.Mock).mockResolvedValue({ user: { role: "MECHANIC", name: "Ka Tono" }, consentRequired: false });
    const out = await signInStaff("tono@autocare.ph", "pw");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("firebase_id_token", "staff-token");
    expect(out.role).toBe("MECHANIC");
  });
  it("rejects a member account", async () => {
    (api.createSession as jest.Mock).mockResolvedValue({ user: { role: "MEMBER" }, consentRequired: true });
    await expect(signInStaff("m@x.ph", "pw")).rejects.toThrow(/staff/i);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("firebase_id_token");
  });
});
```

Run: `pnpm --filter field test` → FAIL.

- [ ] **Step 2: Implement**

`src/features/auth/staffAuth.ts`:
```typescript
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import { api } from "../../shared/api";

if (!getApps().length) {
  initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

export async function signInStaff(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getAuth(), email, password);
  await SecureStore.setItemAsync("firebase_id_token", await cred.user.getIdToken());
  const session = await api.createSession();
  if (!STAFF_ROLES.has(session.user.role)) {
    await SecureStore.deleteItemAsync("firebase_id_token");
    throw new Error("This app is for AutoCare+ staff.");
  }
  return { role: session.user.role, name: session.user.name };
}
```
`src/shared/api.ts`: identical to the member app's (SecureStore-backed `getToken`). Wire `StaffLoginScreen`'s Phase 0 form to `signInStaff` — 56pt controls, error text in `danger`, success routes to the placeholder home showing name + role chip. `App.tsx`: boot check mirrors member's `classifySession` pattern (token + `last_active_at`).

- [ ] **Step 3: Run tests + simulator check**

Run: `pnpm --filter field test` → PASS. Boot `expo start --ios`, sign in with the staff account from Task 10 → placeholder home shows "MECHANIC". Screenshot for the PR.

- [ ] **Step 4: Commit**

```bash
git add apps/field
git commit -m "feat(field): staff email sign-in against session exchange (F-01)"
```

---

### Task 12: Auth rate limiting + session expiry (FR-015, NFR-023)

**Files:**
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/users/consent.controller.ts`, `apps/member/src/features/auth/session.ts`, `apps/member/src/app/RootNavigator.tsx`, `apps/member/package.json`
- Create: `apps/api/src/common/throttler/throttler.guard.ts`
- Test: `apps/api/test/throttle.e2e-spec.ts`, member `session.test.ts` (extend)

**Interfaces:**
- Consumes: `@nestjs/throttler`, `DomainError`, member `classifySession` (Task 8).
- Produces: global limit 100/min per IP; `/auth/*` endpoints 5/min; violations → 429 `RATE_LIMITED` in the envelope. Member app: biometric gate (`expo-local-authentication`) before reusing a stored token; >30-day-idle token discarded (already in `classifySession`).

- [ ] **Step 1: Write the failing e2e test**

Run: `pnpm --filter api add @nestjs/throttler`
`test/throttle.e2e-spec.ts`:
```typescript
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";

describe("throttling (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async () => ({ uid: "throttle-uid" }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
  });
  afterAll(() => app.close());

  it("6th auth call within a minute returns 429 RATE_LIMITED (NFR-023)", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer t");
    }
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer t").expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});
```
(Cleanup: delete user `throttle-uid` in `afterAll` via `PrismaService` as in earlier suites.)

Run: `pnpm --filter api test -- throttle` → FAIL (6th call is 201).

- [ ] **Step 2: Implement throttler**

`src/common/throttler/throttler.guard.ts`:
```typescript
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { DomainError } from "../errors/domain-error";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new DomainError("RATE_LIMITED", "Too many requests — try again in a minute", 429);
  }
}
```
`app.module.ts`: `ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }])` + `{ provide: APP_GUARD, useClass: AppThrottlerGuard }` registered **first** (throttling must run before auth). On `AuthController` and `ConsentController` add `@Throttle({ default: { limit: 5, ttl: 60_000 } })`. Other e2e suites that hammer endpoints stay under 100/min; if one flakes, add `@SkipThrottle()`-via-env is **not** allowed — raise that suite's distinct IPs with supertest's `.set("X-Forwarded-For", …)` only if actually needed.

- [ ] **Step 3: Member biometric gate (FR-015)**

Run: `pnpm --filter member add expo-local-authentication`
Extend `session.ts`:
```typescript
import * as LocalAuthentication from "expo-local-authentication";

export async function biometricGate(): Promise<boolean> {
  const capable = await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
  if (!capable) return true; // no biometrics enrolled — fall through, token alone suffices
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock AutoCare+" });
  return res.success;
}
```
In `bootstrap()`, after `classifySession` returns `TOKEN_OK` and **before** `api.createSession()`: `if (!(await biometricGate())) return "ANONYMOUS";`. Extend `session.test.ts` with a boundary case: exactly 30 days idle → still `TOKEN_OK`; 30 days + 1 ms → `ANONYMOUS`:
```typescript
  it("expires exactly past the 30-day boundary", () => {
    const THIRTY = 30 * 24 * 3600 * 1000;
    expect(classifySession("tok", String(now - THIRTY), now)).toBe("TOKEN_OK");
    expect(classifySession("tok", String(now - THIRTY - 1), now)).toBe("ANONYMOUS");
  });
```

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter api test && pnpm --filter member test` → green. Then the whole workspace: `pnpm turbo run typecheck lint test` → green.

- [ ] **Step 5: Manual verification**

FaceID-enrolled simulator (Features → Face ID → Enrolled): relaunch app → FaceID prompt appears before home; "Matching Face" passes through. API: 6 rapid curls to `/auth/session` → 6th returns the 429 envelope.

- [ ] **Step 6: Commit**

```bash
git add apps/api apps/member
git commit -m "feat: auth throttling (5/min) + biometric unlock and 30-day expiry (FR-015, NFR-023)"
```

---

## Exit criteria

- Fresh install → registered, consented member with one vehicle (validated plate, photos) entirely on the iOS simulator against the local API (Task 9 Step 4 recording).
- Google sign-in works on iOS; staff login works on web with role-gated routing (Playwright green) and in the field app.
- CASL matrix and consent guard covered by unit/e2e tests; `pnpm turbo run typecheck lint test` green locally and in CI.
- FR-001→FR-015 traceable to passing tests — update the RTM notes; mark FR-008/FR-009 as "data + authz layer (Phase 1), fleet UX Phase 7".
- Risks R-01 (re-verified with email/password + Google) and R-12 (web session) recorded as closed in PR descriptions.

## Requirements traceability

| FR | Where proven |
|---|---|
| FR-001, FR-002, FR-010 | Task 8 (Firebase email/password + Google; verification + reset emails; manual e2e Step 5) |
| FR-003, FR-004 | Task 6 e2e create; Task 9 AddVehicle |
| FR-005 | Task 2 plate tests; Task 6 duplicate-409 e2e |
| FR-006 | Task 7 signed-url tests; Task 9 photos flow |
| FR-007 | Task 4 ability matrix; Task 6 cross-member/staff e2e |
| FR-008, FR-009 | Task 1 org schema + Task 4 FLEET_MANAGER abilities (UX in Phase 7) |
| FR-011 | Task 5 profile e2e; Task 9 ProfileScreen |
| FR-012 | Task 3 consent e2e; Task 8 ConsentScreen |
| FR-013 | Task 5 DPA processor + e2e; Task 9 PrivacyScreen |
| FR-014 | Task 5 suspension + audit e2e |
| FR-015 | Task 12 throttle e2e + session boundary tests + biometric gate |
| FR-048 (early) | Task 6 odometer e2e |
