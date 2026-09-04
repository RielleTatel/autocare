# Announcements & Service Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a member-facing Announcements feed of stateful threads that update in place, make it the single source of `SERVICE_DUE` for the attention dashboard, and fix the two defects that leave maintenance reminders non-functional today.

**Architecture:** A new `Announcement` table holds one open thread per (member, vehicle, serviceType), enforced by a *partial* unique index scoped to `status = 'ACTIVE'`. A pure state machine decides transitions; an `AnnouncementsService` applies them, driven by the existing daily reminder job, appointment lifecycle calls, a new T-24h/T-2h job, and admin broadcasts. `attention.service.ts` stops reading `ServiceReminder` and reads `ACTIVE` `SERVICE_DUE` announcements instead; `service_reminders` is dropped once no consumer remains.

**Tech Stack:** NestJS 10 + Prisma 5 (Postgres/Supabase), BullMQ + Redis, Zod contracts in `packages/contracts`, React Native/Expo (member), Next.js App Router (web admin), Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-09-04-announcements-and-service-reminders-design.md`

## Global Constraints

- Monorepo is pnpm + Turborepo. Full verification is `pnpm turbo run typecheck lint test` from the repo root.
- Real-DB e2e tests run against **hosted Supabase**. Tests MUST use prefix-scoped cleanup (a `TAG` constant, as in `apps/api/test/attention.e2e-spec.ts`) and MUST NEVER truncate tables. Jest `testTimeout` is already raised to 30s for remote latency.
- Prisma `migrate dev` needs the local Docker Postgres as `shadowDatabaseUrl`; `DATABASE_URL` points at Supabase. Bring the local DB up with `docker compose up -d` first.
- All cron schedules use `tz: "Asia/Manila"` (`MANILA_TZ` in `scheduling.scheduler.ts`).
- API time logic takes the clock from `@Inject(CLOCK)` (`apps/api/src/common/clock/clock.ts`) — never `new Date()` inside a service method that tests need to control.
- Member RN screens use `theme` from `apps/member/src/theme` and existing primitives (`Card`, `Button`, `StatusPill`, `EmptyState`, `Plate`, `Icon`). Use `t.text(role)` for typography — never pass `fontWeight`.
- Contracts are the single source of shared types: add to `packages/contracts/src/` and re-export from `packages/contracts/src/index.ts`.
- Commit after every task.

---

## File Structure

**Created:**
- `packages/contracts/src/announcements.ts` — Zod schemas + shared types
- `apps/api/src/modules/announcements/announcement-thread.ts` — pure state machine + copy rendering
- `apps/api/src/modules/announcements/announcement-thread.spec.ts`
- `apps/api/src/modules/announcements/announcements.service.ts` — persistence + feed
- `apps/api/src/modules/announcements/announcements.service.spec.ts`
- `apps/api/src/modules/announcements/announcements.controller.ts` — member endpoints
- `apps/api/src/modules/announcements/admin-announcements.controller.ts` — FR-107
- `apps/api/src/modules/announcements/announcements.module.ts`
- `apps/api/test/announcements.e2e-spec.ts`
- `apps/member/src/features/announcements/announcementsApi.ts`
- `apps/member/src/features/announcements/AnnouncementsScreen.tsx`
- `apps/member/src/features/announcements/AnnouncementsScreen.test.tsx`
- `apps/web/lib/announcements/api.ts`
- `apps/web/app/admin/announcements/page.tsx`
- `apps/web/app/admin/announcements/page.test.tsx`

**Modified:**
- `apps/api/prisma/schema.prisma` — add `Announcement`/`AnnouncementRead`, add `Vehicle.lastServiceAt`, later drop `ServiceReminder`
- `apps/api/prisma/seed-scheduling.ts` — add intervals
- `packages/contracts/src/vehicles.ts` — add `lastServiceAt`
- `apps/api/src/modules/scheduling/reminders.service.ts` — baseline precedence, write announcements
- `apps/api/src/modules/scheduling/appointments.service.ts` — emit lifecycle events
- `apps/api/src/modules/scheduling/scheduling.scheduler.ts` + `scheduling.processor.ts` — new reminder job
- `apps/api/src/modules/attention/attention.service.ts` — read announcements
- `apps/member/src/features/vehicles/AddVehicleScreen.tsx` — last-service date field
- `apps/member/src/app/RootNavigator.tsx` — Announcements route + container
- `apps/member/src/features/account/AccountScreen.tsx` — Announcements row + badge

---

## Task 1: Seed service-type maintenance intervals

Closes Defect 1. Without this the daily job short-circuits and no reminder has ever been created on a seeded environment.

**Files:**
- Modify: `apps/api/prisma/seed-scheduling.ts:15-21`
- Test: `apps/api/test/scheduling-config.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: seeded `ServiceType` rows carrying `intervalDays` / `intervalKm`, which `RemindersService.dueCandidates()` already filters on

- [ ] **Step 1: Write the failing test**

> **Revised 2026-09-04 after Task 1 review.** The original version of this test queried
> globally-seeded DB rows by hardcoded production codes, so it depended on `seed-scheduling.ts`
> having been run out-of-band and would fail on a fresh CI database with no code regression.
> It also used `expect(t.intervalDays ?? t.intervalKm).not.toBeNull()`, which cannot catch a
> transposed value or an interval set on the wrong field. Replaced with a DB-free assertion over
> the seed's exported data definition, asserting the exact pair per code.

First export the constant so the test can assert against it — in
`apps/api/prisma/seed-scheduling.ts` change `const SERVICE_TYPES = [` to
`export const SERVICE_TYPES = [`.

Append to `apps/api/test/scheduling-config.e2e-spec.ts`, inside the existing top-level `describe`:

```ts
import { SERVICE_TYPES } from "../prisma/seed-scheduling";

it("seeds the exact maintenance intervals every reminder-generating service type needs", () => {
  // dueCandidates() selects only service types with a non-null interval, so a type
  // shipped without one is invisible to the daily reminder job — permanently.
  const EXPECTED: Record<string, { intervalDays: number | null; intervalKm: number | null }> = {
    OIL_CHANGE: { intervalDays: 180, intervalKm: 5000 },
    TIRE_ROTATION: { intervalDays: 180, intervalKm: 10000 },
    BRAKE_SERVICE: { intervalDays: null, intervalKm: 20000 },
    AC_SERVICE: { intervalDays: 365, intervalKm: null },
    FULL_INSPECTION: { intervalDays: 365, intervalKm: 15000 },
  };

  expect(SERVICE_TYPES.map((s) => s.code).sort()).toEqual(Object.keys(EXPECTED).sort());

  for (const st of SERVICE_TYPES) {
    expect({ intervalDays: st.intervalDays, intervalKm: st.intervalKm }).toEqual(EXPECTED[st.code]);
    expect(st.intervalDays ?? st.intervalKm).not.toBeNull();
  }
});
```

`seed-scheduling.ts` calls `main()` at module scope. If importing it fires the seed or opens a
DB connection during the test run, guard the invocation with `if (require.main === module) { … }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- scheduling-config.e2e-spec`
Expected: FAIL — `SERVICE_TYPES` carries no interval fields, so each `{ intervalDays, intervalKm }`
comes back `{ undefined, undefined }` against the expected pair.

- [ ] **Step 3: Add the intervals to the seed**

Replace the `SERVICE_TYPES` array in `apps/api/prisma/seed-scheduling.ts`:

```ts
const SERVICE_TYPES = [
  { code: "OIL_CHANGE", name: "Oil Change", standardDurationMin: 45, requiredSkills: ["GENERAL"], priceCentavos: 85000n, intervalDays: 180, intervalKm: 5000 },
  { code: "TIRE_ROTATION", name: "Tire Rotation", standardDurationMin: 30, requiredSkills: ["GENERAL"], priceCentavos: 45000n, intervalDays: 180, intervalKm: 10000 },
  { code: "BRAKE_SERVICE", name: "Brake Service", standardDurationMin: 90, requiredSkills: ["BRAKES"], priceCentavos: 180000n, intervalDays: null, intervalKm: 20000 },
  { code: "AC_SERVICE", name: "A/C Service", standardDurationMin: 60, requiredSkills: ["AC"], priceCentavos: 150000n, intervalDays: 365, intervalKm: null },
  { code: "FULL_INSPECTION", name: "Full Inspection", standardDurationMin: 60, requiredSkills: ["GENERAL"], priceCentavos: 60000n, intervalDays: 365, intervalKm: 15000 },
];
```

Confirm the upsert in the same file writes these columns. If it uses an explicit field list, add `intervalDays` and `intervalKm` to both its `create` and `update` blocks.

- [ ] **Step 4: Re-run the seed, then the test**

Run: `pnpm --filter api exec ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-scheduling.ts`
Then: `pnpm --filter api test -- scheduling-config.e2e-spec`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/seed-scheduling.ts apps/api/test/scheduling-config.e2e-spec.ts
git commit -m "fix(scheduling): seed maintenance intervals so reminders actually generate"
```

---

## Task 2: Capture the last-service date at vehicle registration

Closes Defect 2. The client doc promises members enter "the date of the last service"; today the baseline silently falls back to `createdAt`.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Vehicle), `packages/contracts/src/vehicles.ts`, `apps/api/src/modules/vehicles/vehicles.service.ts:9-11,46-56`, `apps/api/src/modules/scheduling/reminders.service.ts:60-110`, `apps/member/src/features/vehicles/AddVehicleScreen.tsx`
- Test: `packages/contracts/src/vehicles.test.ts`, `apps/api/src/modules/scheduling/reminders.service.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Vehicle.lastServiceAt: Date | null`; `dueCandidates()` baseline precedence = last COMPLETED appointment → `lastServiceAt` → `createdAt`

- [ ] **Step 1: Write the failing contract test**

Append to `packages/contracts/src/vehicles.test.ts` inside the existing `describe`:

```ts
it("accepts an optional ISO last-service date", () => {
  const parsed = vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", lastServiceAt: "2026-03-01" });
  expect(parsed.lastServiceAt).toBe("2026-03-01");
  expect(vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234" }).lastServiceAt).toBeUndefined();
});

it("rejects a future last-service date", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  expect(() => vehicleCreateSchema.parse({ ...base, plateNo: "ABA1234", lastServiceAt: future })).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/contracts test`
Expected: FAIL — `lastServiceAt` is stripped as an unknown key, so it is `undefined` and the future date does not throw.

- [ ] **Step 3: Add the field to the contract**

In `packages/contracts/src/vehicles.ts`, add to `vehicleCreateSchema` after `odometerKm`:

```ts
  /** Date of the member's last service, if known — improves reminder accuracy (FR-047). */
  lastServiceAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((s) => new Date(`${s}T00:00:00Z`).getTime() <= Date.now(), { message: "Last service cannot be in the future" })
    .optional(),
```

`vehicleUpdateSchema` derives from it via `.partial()`, so it becomes editable automatically.

- [ ] **Step 4: Run contract tests**

Run: `pnpm --filter @autocare/contracts test`
Expected: PASS

- [ ] **Step 5: Write the failing baseline-precedence test**

Append to `apps/api/src/modules/scheduling/reminders.service.spec.ts`. This tests the pure `dueReason` caller indirectly through a small extracted helper, so add the helper import at the top of the file alongside the existing imports:

```ts
import { resolveBaselineDate } from "./reminders.service";

describe("resolveBaselineDate", () => {
  const completed = new Date("2026-06-01T00:00:00Z");
  const lastService = new Date("2026-03-01T00:00:00Z");
  const created = new Date("2026-01-01T00:00:00Z");

  it("prefers the last completed appointment", () => {
    expect(resolveBaselineDate(completed, lastService, created)).toEqual(completed);
  });

  it("falls back to the member-entered last-service date", () => {
    expect(resolveBaselineDate(undefined, lastService, created)).toEqual(lastService);
  });

  it("falls back to registration date when nothing else is known", () => {
    expect(resolveBaselineDate(undefined, null, created)).toEqual(created);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter api test -- reminders.service.spec`
Expected: FAIL with "resolveBaselineDate is not a function".

- [ ] **Step 7: Add the schema column and the helper**

In `apps/api/prisma/schema.prisma`, add to `model Vehicle` after `currentOdometerKm`:

```prisma
  lastServiceAt     DateTime?         @map("last_service_at")
```

In `apps/api/src/modules/scheduling/reminders.service.ts`, add the exported helper next to the other pure functions (above the `@Injectable()` class):

```ts
/**
 * Baseline for a service interval, most-trustworthy first: a real completed appointment of
 * that type, else the member-entered last-service date, else vehicle registration.
 */
export function resolveBaselineDate(
  lastCompleted: Date | undefined,
  lastServiceAt: Date | null,
  createdAt: Date,
): Date {
  return lastCompleted ?? lastServiceAt ?? createdAt;
}
```

Then use it in `dueCandidates()`. Change the vehicle select on line ~64 to include the new column:

```ts
        select: { id: true, currentOdometerKm: true, createdAt: true, lastServiceAt: true },
```

and replace the `baselineDate` argument in the `dueReason({...})` call:

```ts
          baselineDate: resolveBaselineDate(lastServiceAt.get(`${v.id}:${st.id}`), v.lastServiceAt, v.createdAt),
```

- [ ] **Step 8: Generate the migration and run the tests**

```bash
docker compose up -d
pnpm --filter api exec prisma migrate dev --name vehicle-last-service-at
pnpm --filter api test -- reminders.service.spec
```
Expected: PASS

- [ ] **Step 9: Persist the field through the vehicles service**

In `apps/api/src/modules/vehicles/vehicles.service.ts`, add `lastServiceAt: true` to `VEHICLE_SELECT` (line 9-11). In `create()`, the existing destructure `const { odometerKm, ...fields } = dto;` already forwards it, but the string must become a Date — replace that line and the `data:` block:

```ts
    const { odometerKm, lastServiceAt, ...fields } = dto;
```

```ts
        data: { ...fields, ...owner, currentOdometerKm: odometerKm,
                lastServiceAt: lastServiceAt ? new Date(`${lastServiceAt}T00:00:00Z`) : null,
                odometerReadings: { create: { km: odometerKm, source: "MEMBER", recordedBy: user.id } } },
```

Apply the same string→Date conversion in `update()`:

```ts
  async update(user: AbilityUser, id: string, dto: VehicleUpdate) {
    await this.findForUser(user, id, "update");
    const { lastServiceAt, ...rest } = dto;
    const row = await this.prisma.vehicle.update({
      where: { id },
      data: { ...rest, ...(lastServiceAt !== undefined ? { lastServiceAt: lastServiceAt ? new Date(`${lastServiceAt}T00:00:00Z`) : null } : {}) },
      select: VEHICLE_SELECT,
    });
    return toVehicleResponse(row);
  }
```

Add `lastServiceAt: z.string().nullable()` to `vehicleSchema` in `packages/contracts/src/vehicles.ts` so the response shape stays in sync.

- [ ] **Step 10: Add the member app field**

In `apps/member/src/features/vehicles/AddVehicleScreen.tsx`, add `lastServiceAt: ""` to `emptyVehicleForm`, and render a field inside the collapsible "more" section (next to the other optional inputs):

```tsx
        <TextField name="lastServiceAt" value={form.lastServiceAt} onChangeText={set("lastServiceAt")}
          placeholder="2026-03-01" error={errors.lastServiceAt} />
```

Label it "Last service date (optional)" using the same label element the neighbouring fields use, and include `lastServiceAt: form.lastServiceAt || undefined` in the submit payload.

- [ ] **Step 11: Run the full suite**

Run: `pnpm turbo run typecheck test`
Expected: all green.

- [ ] **Step 12: Commit**

```bash
git add apps/api/prisma packages/contracts/src/vehicles.ts apps/api/src/modules/vehicles apps/api/src/modules/scheduling/reminders.service.ts apps/api/src/modules/scheduling/reminders.service.spec.ts packages/contracts/src/vehicles.test.ts apps/member/src/features/vehicles/AddVehicleScreen.tsx
git commit -m "feat(vehicles): capture last-service date and use it as the reminder baseline"
```

---

## Task 3: Announcement schema (additive)

Additive only — `ServiceReminder` stays until its consumers are migrated in Tasks 7 and 10.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Consumes: nothing
- Produces: `Announcement` and `AnnouncementRead` Prisma models; partial unique index `announcements_open_thread`

- [ ] **Step 1: Add the models**

Append to `apps/api/prisma/schema.prisma`:

```prisma
enum AnnouncementKind {
  SERVICE_DUE
  APPOINTMENT_BOOKED
  APPOINTMENT_REMINDER
  APPOINTMENT_RESCHEDULED
  APPOINTMENT_CANCELLED
  SERVICE_COMPLETED
  ADMIN_BROADCAST
}

enum AnnouncementStatus {
  ACTIVE
  SUPERSEDED
  DISMISSED
}

model Announcement {
  id            String             @id @default(uuid()) @db.Uuid
  userId        String?            @map("user_id") @db.Uuid
  kind          AnnouncementKind
  status        AnnouncementStatus @default(ACTIVE)
  title         String
  body          String
  vehicleId     String?            @map("vehicle_id") @db.Uuid
  serviceTypeId String?            @map("service_type_id") @db.Uuid
  appointmentId String?            @map("appointment_id") @db.Uuid
  reason        String?
  publishedAt   DateTime           @default(now()) @map("published_at")
  expiresAt     DateTime?          @map("expires_at")
  createdBy     String?            @map("created_by") @db.Uuid
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")
  reads         AnnouncementRead[]

  @@index([userId, status, publishedAt])
  @@map("announcements")
}

model AnnouncementRead {
  announcementId String       @map("announcement_id") @db.Uuid
  userId         String       @map("user_id") @db.Uuid
  readAt         DateTime     @default(now()) @map("read_at")
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)

  @@id([announcementId, userId])
  @@map("announcement_reads")
}
```

- [ ] **Step 2: Generate the migration**

```bash
docker compose up -d
pnpm --filter api exec prisma migrate dev --name announcements
```

- [ ] **Step 3: Add the partial unique index by hand**

Prisma cannot express partial uniques. Open the generated file under `apps/api/prisma/migrations/<timestamp>_announcements/migration.sql` and append:

```sql
-- At most one OPEN thread per (member, vehicle, service type). Closed threads stay
-- as history, so a total unique constraint would block the next service cycle.
CREATE UNIQUE INDEX "announcements_open_thread"
  ON "announcements" ("user_id", "vehicle_id", "service_type_id")
  WHERE "status" = 'ACTIVE';
```

Re-apply it: `pnpm --filter api exec prisma migrate reset --skip-seed --force` is **not** safe here (Supabase). Instead apply the index directly:

```bash
pnpm --filter api exec prisma db execute --file prisma/migrations/<timestamp>_announcements/migration.sql --schema prisma/schema.prisma
```

- [ ] **Step 4: Verify the index exists**

Create `apps/api/test/announcements-schema.e2e-spec.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("announcements schema", () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it("has a partial unique index scoped to ACTIVE threads", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'announcements_open_thread'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("WHERE (status = 'ACTIVE'");
  });
});
```

Run: `pnpm --filter api test -- announcements-schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/test/announcements-schema.e2e-spec.ts
git commit -m "feat(announcements): add Announcement schema with partial open-thread index"
```

---

## Task 4: Announcement contracts

**Files:**
- Create: `packages/contracts/src/announcements.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/announcements.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `announcementKinds`, `AnnouncementKind`, `AnnouncementStatus`, `AnnouncementItem`, `AnnouncementFeed`, `broadcastCreateSchema`, `BroadcastCreate`

- [ ] **Step 1: Write the failing test**

Create `packages/contracts/src/announcements.test.ts`:

```ts
import { broadcastCreateSchema } from "./announcements";

describe("announcement contracts", () => {
  it("accepts a title and body", () => {
    const parsed = broadcastCreateSchema.parse({ title: "Holiday hours", body: "Closed Dec 25." });
    expect(parsed.title).toBe("Holiday hours");
    expect(parsed.expiresAt).toBeUndefined();
  });

  it("rejects an empty title", () => {
    expect(() => broadcastCreateSchema.parse({ title: "", body: "x" })).toThrow();
  });

  it("rejects a body over 2000 characters", () => {
    expect(() => broadcastCreateSchema.parse({ title: "t", body: "x".repeat(2001) })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/contracts test -- announcements`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the contract**

Create `packages/contracts/src/announcements.ts`:

```ts
import { z } from "zod";

export const announcementKinds = [
  "SERVICE_DUE",
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_REMINDER",
  "APPOINTMENT_RESCHEDULED",
  "APPOINTMENT_CANCELLED",
  "SERVICE_COMPLETED",
  "ADMIN_BROADCAST",
] as const;
export type AnnouncementKind = (typeof announcementKinds)[number];

export const announcementStatuses = ["ACTIVE", "SUPERSEDED", "DISMISSED"] as const;
export type AnnouncementStatus = (typeof announcementStatuses)[number];

/** One thread as the member sees it. `read` is per-viewer, not a column on the row. */
export interface AnnouncementItem {
  id: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  title: string;
  body: string;
  vehicleId: string | null;
  plate?: string;
  serviceTypeId: string | null;
  appointmentId: string | null;
  publishedAt: string;
  read: boolean;
}

export interface AnnouncementFeed {
  items: AnnouncementItem[];
  unreadCount: number;
}

/** FR-107 admin broadcast. Audience is ALL for v1 — see spec §9. */
export const broadcastCreateSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  expiresAt: z.string().datetime().optional(),
});
export type BroadcastCreate = z.infer<typeof broadcastCreateSchema>;
```

- [ ] **Step 4: Export it**

Add to `packages/contracts/src/index.ts` after the `attention` line:

```ts
export * from "./announcements";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @autocare/contracts test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/announcements.ts packages/contracts/src/announcements.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add announcement types and broadcast schema"
```

---

## Task 5: Pure thread state machine

The transition table from spec §5, as a pure function — no Prisma, no clock.

**Files:**
- Create: `apps/api/src/modules/announcements/announcement-thread.ts`
- Test: `apps/api/src/modules/announcements/announcement-thread.spec.ts`

**Interfaces:**
- Consumes: `AnnouncementKind`, `AnnouncementStatus` from `@autocare/contracts`
- Produces: `ThreadEvent`, `ThreadState`, `nextThreadState(current, event)`, `renderAnnouncementCopy(input)`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/announcements/announcement-thread.spec.ts`:

```ts
import { nextThreadState, renderAnnouncementCopy, ThreadState } from "./announcement-thread";

const active = (kind: ThreadState["kind"]): ThreadState => ({ kind, status: "ACTIVE" });

describe("nextThreadState", () => {
  it("opens a SERVICE_DUE thread when none exists", () => {
    expect(nextThreadState(null, { type: "SERVICE_DUE_DETECTED" })).toEqual(active("SERVICE_DUE"));
  });

  it("leaves an already-open SERVICE_DUE thread untouched (idempotent daily job)", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "SERVICE_DUE_DETECTED" })).toBeNull();
  });

  it("moves a due thread to booked", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "APPOINTMENT_BOOKED" })).toEqual(active("APPOINTMENT_BOOKED"));
  });

  it("moves a booked thread to reminder", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_REMINDER_DUE" })).toEqual(active("APPOINTMENT_REMINDER"));
  });

  it("does not re-send a reminder for a thread already reminded", () => {
    expect(nextThreadState(active("APPOINTMENT_REMINDER"), { type: "APPOINTMENT_REMINDER_DUE" })).toBeNull();
  });

  it("returns a cancelled appointment to due — the service is still needed", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_CANCELLED" })).toEqual(active("SERVICE_DUE"));
  });

  it("reschedules from either booked or reminded", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_RESCHEDULED" })).toEqual(active("APPOINTMENT_RESCHEDULED"));
    expect(nextThreadState(active("APPOINTMENT_REMINDER"), { type: "APPOINTMENT_RESCHEDULED" })).toEqual(active("APPOINTMENT_RESCHEDULED"));
  });

  it("closes the thread when the service completes", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "SERVICE_COMPLETED" }))
      .toEqual({ kind: "SERVICE_COMPLETED", status: "SUPERSEDED" });
  });

  it("dismisses an open thread", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "DISMISSED" }))
      .toEqual({ kind: "SERVICE_DUE", status: "DISMISSED" });
  });

  it("ignores every event on a closed thread", () => {
    const closed: ThreadState = { kind: "SERVICE_COMPLETED", status: "SUPERSEDED" };
    expect(nextThreadState(closed, { type: "APPOINTMENT_BOOKED" })).toBeNull();
    expect(nextThreadState(closed, { type: "DISMISSED" })).toBeNull();
  });

  it("ignores a booking event when no thread exists", () => {
    expect(nextThreadState(null, { type: "APPOINTMENT_BOOKED" })).toBeNull();
  });
});

describe("renderAnnouncementCopy", () => {
  const when = new Date("2026-09-12T02:00:00Z");

  it("names the service and the trigger for a due thread", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_DUE", serviceTypeName: "Oil Change", reason: "ODOMETER" }))
      .toEqual({ title: "Oil Change due", body: "Your mileage since the last Oil Change has reached the recommended interval." });
  });

  it("uses elapsed-time wording for a time-triggered thread", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_DUE", serviceTypeName: "Oil Change", reason: "TIME" }).body)
      .toBe("It has been long enough since the last Oil Change to book the next one.");
  });

  it("states the date once booked", () => {
    const copy = renderAnnouncementCopy({ kind: "APPOINTMENT_BOOKED", serviceTypeName: "Oil Change", scheduledStart: when });
    expect(copy.title).toBe("Oil Change scheduled");
    expect(copy.body).toContain("12 Sep 2026");
  });

  it("confirms completion", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_COMPLETED", serviceTypeName: "Oil Change" }))
      .toEqual({ title: "Oil Change completed", body: "This service is recorded in your vehicle's history." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- announcement-thread`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the state machine**

Create `apps/api/src/modules/announcements/announcement-thread.ts`:

```ts
import type { AnnouncementKind, AnnouncementStatus } from "@autocare/contracts";

export type ThreadState = { kind: AnnouncementKind; status: AnnouncementStatus };

export type ThreadEvent =
  | { type: "SERVICE_DUE_DETECTED" }
  | { type: "APPOINTMENT_BOOKED" }
  | { type: "APPOINTMENT_REMINDER_DUE" }
  | { type: "APPOINTMENT_RESCHEDULED" }
  | { type: "APPOINTMENT_CANCELLED" }
  | { type: "SERVICE_COMPLETED" }
  | { type: "DISMISSED" };

/** Kinds that mean "an appointment exists for this thread". */
const BOOKED_KINDS: AnnouncementKind[] = ["APPOINTMENT_BOOKED", "APPOINTMENT_REMINDER", "APPOINTMENT_RESCHEDULED"];

/**
 * The transition table from the design spec §5. Returns the next state, or `null` when the
 * event is a no-op — which is what makes the daily and hourly jobs safe to re-run.
 *
 * Pure: no clock, no database. `null` current state means "no open thread".
 */
export function nextThreadState(current: ThreadState | null, event: ThreadEvent): ThreadState | null {
  // A closed thread is history — nothing reopens it. The next cycle opens a fresh one.
  if (current && current.status !== "ACTIVE") return null;

  if (!current) {
    // Only a due-detection can open a thread; lifecycle events without one are ignored.
    return event.type === "SERVICE_DUE_DETECTED" ? { kind: "SERVICE_DUE", status: "ACTIVE" } : null;
  }

  switch (event.type) {
    case "SERVICE_DUE_DETECTED":
      return null; // already open — idempotent
    case "APPOINTMENT_BOOKED":
      return current.kind === "SERVICE_DUE" ? { kind: "APPOINTMENT_BOOKED", status: "ACTIVE" } : null;
    case "APPOINTMENT_REMINDER_DUE":
      return current.kind === "APPOINTMENT_BOOKED" || current.kind === "APPOINTMENT_RESCHEDULED"
        ? { kind: "APPOINTMENT_REMINDER", status: "ACTIVE" }
        : null;
    case "APPOINTMENT_RESCHEDULED":
      return BOOKED_KINDS.includes(current.kind) ? { kind: "APPOINTMENT_RESCHEDULED", status: "ACTIVE" } : null;
    case "APPOINTMENT_CANCELLED":
      // The service is still due — fall back rather than close.
      return BOOKED_KINDS.includes(current.kind) ? { kind: "SERVICE_DUE", status: "ACTIVE" } : null;
    case "SERVICE_COMPLETED":
      return { kind: "SERVICE_COMPLETED", status: "SUPERSEDED" };
    case "DISMISSED":
      return { kind: current.kind, status: "DISMISSED" };
    default:
      return null;
  }
}

export type CopyInput = {
  kind: AnnouncementKind;
  serviceTypeName: string;
  scheduledStart?: Date;
  reason?: string | null;
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila",
});

/** Member-facing copy for a thread state. Plain language, no jargon (FR-062 house style). */
export function renderAnnouncementCopy(input: CopyInput): { title: string; body: string } {
  const svc = input.serviceTypeName;
  const on = input.scheduledStart ? DATE_FMT.format(input.scheduledStart) : "";

  switch (input.kind) {
    case "SERVICE_DUE":
      return {
        title: `${svc} due`,
        body: input.reason === "ODOMETER"
          ? `Your mileage since the last ${svc} has reached the recommended interval.`
          : `It has been long enough since the last ${svc} to book the next one.`,
      };
    case "APPOINTMENT_BOOKED":
      return { title: `${svc} scheduled`, body: `Booked for ${on}. We'll remind you the day before.` };
    case "APPOINTMENT_REMINDER":
      return { title: `${svc} tomorrow`, body: `Your appointment is on ${on}. Reschedule from Bookings if you need to.` };
    case "APPOINTMENT_RESCHEDULED":
      return { title: `${svc} moved`, body: `Your appointment is now on ${on}.` };
    case "APPOINTMENT_CANCELLED":
      return { title: `${svc} cancelled`, body: `The appointment was cancelled. This service is still due.` };
    case "SERVICE_COMPLETED":
      return { title: `${svc} completed`, body: `This service is recorded in your vehicle's history.` };
    default:
      return { title: svc, body: "" };
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter api test -- announcement-thread`
Expected: PASS (all 15)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/announcements/
git commit -m "feat(announcements): pure thread state machine and member copy"
```

---

## Task 6: AnnouncementsService

**Files:**
- Create: `apps/api/src/modules/announcements/announcements.service.ts`, `announcements.module.ts`
- Test: `apps/api/src/modules/announcements/announcements.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `AnnouncementsModule`)

**Interfaces:**
- Consumes: `nextThreadState`, `renderAnnouncementCopy` (Task 5); `PrismaService`
- Produces:
  - `applyThreadEvent(input: ThreadEventInput): Promise<void>` where
    `ThreadEventInput = { userId: string; vehicleId: string; serviceTypeId: string; serviceTypeName: string; event: ThreadEvent; appointmentId?: string; scheduledStart?: Date; reason?: string | null }`
  - `feed(userId: string, plates: Map<string,string>): Promise<AnnouncementFeed>`
  - `markRead(userId: string, id: string): Promise<void>`
  - `markAllRead(userId: string): Promise<void>`
  - `dismiss(userId: string, id: string): Promise<void>`
  - `broadcast(adminId: string, dto: BroadcastCreate): Promise<void>`
  - `activeServiceDue(vehicleIds: string[]): Promise<Array<{ vehicleId: string; serviceTypeId: string; serviceTypeName: string; publishedAt: Date }>>`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/announcements/announcements.service.spec.ts`:

```ts
import { AnnouncementsService } from "./announcements.service";

/** Minimal in-memory stand-in for the two tables this service touches. */
function makePrisma() {
  const rows: any[] = [];
  const reads: any[] = [];
  return {
    rows,
    reads,
    announcement: {
      findFirst: jest.fn(async ({ where }: any) =>
        rows.find((r) =>
          r.userId === where.userId && r.vehicleId === where.vehicleId &&
          r.serviceTypeId === where.serviceTypeId && r.status === where.status) ?? null),
      create: jest.fn(async ({ data }: any) => { const row = { id: `a${rows.length + 1}`, ...data }; rows.push(row); return row; }),
      update: jest.fn(async ({ where, data }: any) => { const row = rows.find((r) => r.id === where.id); Object.assign(row, data); return row; }),
      findMany: jest.fn(async () => rows),
    },
    announcementRead: {
      createMany: jest.fn(async ({ data }: any) => { reads.push(...(Array.isArray(data) ? data : [data])); return { count: 1 }; }),
      findMany: jest.fn(async () => reads),
    },
  } as any;
}

describe("AnnouncementsService.applyThreadEvent", () => {
  const base = { userId: "u1", vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change" };

  it("creates a thread on first due detection", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]).toMatchObject({ kind: "SERVICE_DUE", status: "ACTIVE", title: "Oil Change due" });
  });

  it("is idempotent — a second detection creates nothing", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.announcement.create).toHaveBeenCalledTimes(1);
  });

  it("updates the existing thread in place when booked", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    await svc.applyThreadEvent({
      ...base, event: { type: "APPOINTMENT_BOOKED" },
      appointmentId: "ap1", scheduledStart: new Date("2026-09-12T02:00:00Z"),
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]).toMatchObject({ kind: "APPOINTMENT_BOOKED", appointmentId: "ap1", title: "Oil Change scheduled" });
  });

  it("does nothing when an event arrives with no open thread", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "APPOINTMENT_BOOKED" }, appointmentId: "ap1" });
    expect(prisma.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- announcements.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

Create `apps/api/src/modules/announcements/announcements.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import type { AnnouncementFeed, AnnouncementItem, BroadcastCreate } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { nextThreadState, renderAnnouncementCopy, ThreadEvent } from "./announcement-thread";

export type ThreadEventInput = {
  userId: string;
  vehicleId: string;
  serviceTypeId: string;
  serviceTypeName: string;
  event: ThreadEvent;
  appointmentId?: string;
  scheduledStart?: Date;
  reason?: string | null;
};

/**
 * Owns the Announcement table. All thread mutation funnels through `applyThreadEvent`, which
 * defers the decision to the pure state machine and only touches the database when the machine
 * says something changed — that is what makes the repeating jobs idempotent.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async applyThreadEvent(input: ThreadEventInput): Promise<void> {
    const open = await this.prisma.announcement.findFirst({
      where: { userId: input.userId, vehicleId: input.vehicleId, serviceTypeId: input.serviceTypeId, status: "ACTIVE" },
    });

    const current = open ? { kind: open.kind, status: open.status } : null;
    const next = nextThreadState(current, input.event);
    if (!next) return;

    const copy = renderAnnouncementCopy({
      kind: next.kind,
      serviceTypeName: input.serviceTypeName,
      scheduledStart: input.scheduledStart,
      reason: input.reason ?? open?.reason ?? null,
    });

    if (!open) {
      await this.prisma.announcement.create({
        data: {
          userId: input.userId, vehicleId: input.vehicleId, serviceTypeId: input.serviceTypeId,
          kind: next.kind, status: next.status, title: copy.title, body: copy.body,
          reason: input.reason ?? null, appointmentId: input.appointmentId ?? null,
        },
      });
      return;
    }

    await this.prisma.announcement.update({
      where: { id: open.id },
      data: {
        kind: next.kind, status: next.status, title: copy.title, body: copy.body,
        ...(input.appointmentId !== undefined ? { appointmentId: input.appointmentId } : {}),
        ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      },
    });
  }

  /** ACTIVE service-due threads, for the attention dashboard (spec §7). */
  async activeServiceDue(vehicleIds: string[]) {
    if (vehicleIds.length === 0) return [];
    const rows = await this.prisma.announcement.findMany({
      where: { vehicleId: { in: vehicleIds }, kind: "SERVICE_DUE", status: "ACTIVE" },
    });
    const serviceTypeIds = [...new Set(rows.map((r) => r.serviceTypeId).filter((x): x is string => x !== null))];
    const types = await this.prisma.serviceType.findMany({
      where: { id: { in: serviceTypeIds } }, select: { id: true, name: true },
    });
    const nameById = new Map(types.map((t) => [t.id, t.name]));
    return rows.map((r) => ({
      vehicleId: r.vehicleId as string,
      serviceTypeId: r.serviceTypeId as string,
      serviceTypeName: nameById.get(r.serviceTypeId as string) ?? "Service",
      publishedAt: r.publishedAt,
    }));
  }

  /** Personal rows plus live broadcasts, newest first, annotated with per-viewer read state. */
  async feed(userId: string, plates: Map<string, string>, now = new Date()): Promise<AnnouncementFeed> {
    const rows = await this.prisma.announcement.findMany({
      where: {
        OR: [
          { userId },
          { userId: null, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 200,
    });
    const reads = await this.prisma.announcementRead.findMany({
      where: { userId, announcementId: { in: rows.map((r) => r.id) } },
      select: { announcementId: true },
    });
    const readIds = new Set(reads.map((r) => r.announcementId));

    const items: AnnouncementItem[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      title: r.title,
      body: r.body,
      vehicleId: r.vehicleId,
      ...(r.vehicleId && plates.get(r.vehicleId) ? { plate: plates.get(r.vehicleId) } : {}),
      serviceTypeId: r.serviceTypeId,
      appointmentId: r.appointmentId,
      publishedAt: r.publishedAt.toISOString(),
      read: readIds.has(r.id),
    }));
    return { items, unreadCount: items.filter((i) => !i.read).length };
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.announcementRead.createMany({
      data: [{ announcementId: id, userId }],
      skipDuplicates: true,
    });
  }

  async markAllRead(userId: string): Promise<void> {
    const rows = await this.prisma.announcement.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true },
    });
    if (rows.length === 0) return;
    await this.prisma.announcementRead.createMany({
      data: rows.map((r) => ({ announcementId: r.id, userId })),
      skipDuplicates: true,
    });
  }

  async dismiss(userId: string, id: string): Promise<void> {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new DomainError("FORBIDDEN_ROLE", "Announcement not found", 404);
    const next = nextThreadState({ kind: row.kind, status: row.status }, { type: "DISMISSED" });
    if (!next) return;
    await this.prisma.announcement.update({ where: { id }, data: { status: next.status } });
  }

  /** FR-107 — one row with userId null is visible to every member. */
  async broadcast(adminId: string, dto: BroadcastCreate): Promise<void> {
    await this.prisma.announcement.create({
      data: {
        userId: null, kind: "ADMIN_BROADCAST", status: "ACTIVE",
        title: dto.title, body: dto.body, createdBy: adminId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async listBroadcasts() {
    return this.prisma.announcement.findMany({
      where: { kind: "ADMIN_BROADCAST" },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
  }

  async unpublish(id: string): Promise<void> {
    await this.prisma.announcement.update({ where: { id }, data: { status: "SUPERSEDED" } });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter api test -- announcements.service`
Expected: PASS

- [ ] **Step 5: Create the module and register it**

Create `apps/api/src/modules/announcements/announcements.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AnnouncementsService } from "./announcements.service";

@Module({
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
```

Add `AnnouncementsModule` to the `imports` array in `apps/api/src/app.module.ts`, next to the other feature modules.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm --filter api typecheck
git add apps/api/src/modules/announcements apps/api/src/app.module.ts
git commit -m "feat(announcements): AnnouncementsService with idempotent thread application"
```

---

## Task 7: Reminder job writes announcements

**Files:**
- Modify: `apps/api/src/modules/scheduling/reminders.service.ts:117-133`, `apps/api/src/modules/scheduling/scheduling.module.ts`
- Test: `apps/api/src/modules/scheduling/reminders.service.spec.ts`

**Interfaces:**
- Consumes: `AnnouncementsService.applyThreadEvent` (Task 6)
- Produces: `serviceDue(now)` returns `{ created: number }` (unchanged shape) but writes `Announcement` threads

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/scheduling/reminders.service.spec.ts`:

```ts
describe("serviceDue writes announcement threads", () => {
  it("applies a SERVICE_DUE_DETECTED event per due candidate in today's bucket", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const vehicleId = "11111111-1111-1111-1111-111111111111";
    const now = new Date("2026-09-04T00:00:00Z");

    const prisma: any = {
      vehicle: { findMany: jest.fn(async () => [{ id: vehicleId, currentOdometerKm: 20000, createdAt: new Date("2020-01-01"), lastServiceAt: null, ownerUserId: "u1" }]) },
      serviceType: { findMany: jest.fn(async () => [{ id: "s1", name: "Oil Change", intervalDays: 180, intervalKm: 5000 }]) },
      appointment: { findMany: jest.fn(async () => []) },
      odometerReading: { findMany: jest.fn(async () => [{ vehicleId, km: 0 }]) },
    };

    const svc = new RemindersService(prisma, { applyThreadEvent } as any);
    // Force today's bucket to match this vehicle so the stagger filter cannot skip it.
    jest.spyOn(svc as any, "isInTodaysBucket").mockReturnValue(true);

    await svc.serviceDue(now);

    expect(applyThreadEvent).toHaveBeenCalledTimes(1);
    expect(applyThreadEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1", vehicleId, serviceTypeId: "s1", serviceTypeName: "Oil Change",
      event: { type: "SERVICE_DUE_DETECTED" },
    }));
  });
});
```

Ensure `RemindersService` is imported at the top of the spec file if it is not already.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- reminders.service.spec`
Expected: FAIL — constructor takes one argument; `isInTodaysBucket` does not exist.

- [ ] **Step 3: Rewrite `serviceDue`**

In `apps/api/src/modules/scheduling/reminders.service.ts`, inject the new service and replace the `serviceDue` method. Update the constructor:

```ts
  constructor(private prisma: PrismaService, private announcements: AnnouncementsService) {}
```

with the import `import { AnnouncementsService } from "../announcements/announcements.service";` at the top.

`dueCandidates()` must also return the owner and the service name, so extend its select and its return type:

```ts
export type DueCandidate = {
  vehicleId: string;
  serviceTypeId: string;
  reason: DueReason;
  userId: string | null;
  serviceTypeName: string;
};
```

In `dueCandidates()`, change the two `findMany` selects:

```ts
        select: { id: true, currentOdometerKm: true, createdAt: true, lastServiceAt: true, ownerUserId: true },
```
```ts
        select: { id: true, name: true, intervalDays: true, intervalKm: true },
```

and the push:

```ts
        if (reason) out.push({ vehicleId: v.id, serviceTypeId: st.id, reason, userId: v.ownerUserId, serviceTypeName: st.name });
```

Then replace `serviceDue` entirely:

```ts
  /** Extracted so tests can pin the stagger without controlling the hash. */
  private isInTodaysBucket(vehicleId: string, now: Date): boolean {
    return staggerBucket(vehicleId) === bucketForDay(now);
  }

  /**
   * Opens a SERVICE_DUE announcement thread for every due vehicle in today's stagger bucket.
   * Idempotency is the state machine's job — re-running creates nothing new.
   */
  async serviceDue(now: Date): Promise<{ created: number }> {
    const candidates = (await this.dueCandidates(now)).filter((c) => this.isInTodaysBucket(c.vehicleId, now));

    let created = 0;
    for (const c of candidates) {
      if (!c.userId) continue; // org-owned vehicles have no single member to notify
      await this.announcements.applyThreadEvent({
        userId: c.userId,
        vehicleId: c.vehicleId,
        serviceTypeId: c.serviceTypeId,
        serviceTypeName: c.serviceTypeName,
        event: { type: "SERVICE_DUE_DETECTED" },
        reason: c.reason,
      });
      created++;
    }
    return { created };
  }
```

- [ ] **Step 4: Wire the module dependency**

In `apps/api/src/modules/scheduling/scheduling.module.ts`, add `AnnouncementsModule` to `imports`:

```ts
import { AnnouncementsModule } from "../announcements/announcements.module";
```
```ts
  imports: [QueueModule, EntitlementsModule, AnnouncementsModule],
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter api test -- reminders.service.spec`
Expected: PASS. Existing `dueCandidates` tests still pass — only the returned shape gained fields.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scheduling/
git commit -m "feat(scheduling): daily reminder job opens announcement threads"
```

---

## Task 8: Appointment lifecycle drives thread transitions

**Files:**
- Modify: `apps/api/src/modules/scheduling/appointments.service.ts:29-34,62-165`
- Test: `apps/api/src/modules/scheduling/appointments.service.spec.ts`

**Interfaces:**
- Consumes: `AnnouncementsService.applyThreadEvent`
- Produces: `book()`, `reschedule()`, `cancel()` unchanged in signature and return type; each now applies one thread event

- [ ] **Step 1: Add a spy to the existing harness, then write the failing test**

`apps/api/src/modules/scheduling/appointments.service.spec.ts` runs against a **real DB** with a
fake clock and a stubbed `HoldsService`. Add a spy alongside the existing `holdsStub`
declaration (around line 22):

```ts
  const applyThreadEvent = jest.fn(async () => undefined);
  const announcementsStub = { applyThreadEvent } as unknown as AnnouncementsService;
```

with `import { AnnouncementsService } from "../announcements/announcements.service";` at the
top, and reset it in a `beforeEach`:

```ts
  beforeEach(() => { applyThreadEvent.mockClear(); });
```

Update the construction on line 44 to pass it as the fifth argument:

```ts
    service = new AppointmentsService(prisma, holdsStub, entitlements, clock, announcementsStub);
```

Then append the new test, reusing the `member()`, `vehicleId` and `serviceTypeId` bindings the
file already sets up in `beforeAll`:

```ts
describe("appointment lifecycle updates the announcement thread", () => {
  it("applies APPOINTMENT_BOOKED after a successful booking", async () => {
    nextClaim = { bayId, serviceTypeId, startIso: iso(48 * H), endIso: iso(48 * H + 45 * 60 * 1000) } as HoldDetails;

    await service.book(member(), { holdId: "h1", vehicleId, serviceTypeId, requiresPickup: false } as any);

    expect(applyThreadEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: memberId, vehicleId, serviceTypeId,
      event: { type: "APPOINTMENT_BOOKED" },
    }));
  });

  it("applies APPOINTMENT_CANCELLED when the member cancels", async () => {
    nextClaim = { bayId, serviceTypeId, startIso: iso(72 * H), endIso: iso(72 * H + 45 * 60 * 1000) } as HoldDetails;
    const appt = await service.book(member(), { holdId: "h2", vehicleId, serviceTypeId, requiresPickup: false } as any);
    applyThreadEvent.mockClear();

    await service.cancel(member(), appt.id);

    expect(applyThreadEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: memberId, vehicleId, serviceTypeId,
      event: { type: "APPOINTMENT_CANCELLED" },
    }));
  });
});
```

Match `nextClaim`'s exact shape to how the existing tests in this file build it — read one
before writing yours.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- appointments.service.spec`
Expected: FAIL — `AppointmentsService` takes four constructor arguments, and no call is recorded.

- [ ] **Step 3: Inject and emit**

In `apps/api/src/modules/scheduling/appointments.service.ts`, add to the constructor:

```ts
    private announcements: AnnouncementsService,
```

with `import { AnnouncementsService } from "../announcements/announcements.service";`.

At the end of `book()`, immediately before `return this.toDto(created);`:

```ts
    if (vehicle.ownerUserId) {
      await this.announcements.applyThreadEvent({
        userId: vehicle.ownerUserId, vehicleId: dto.vehicleId, serviceTypeId: dto.serviceTypeId,
        serviceTypeName: serviceType.name, event: { type: "APPOINTMENT_BOOKED" },
        appointmentId: created.id, scheduledStart: start,
      });
    }
```

In `reschedule()`, the loaded `appt` lacks the owner and service name, so widen the lookup:

```ts
    const appt = await this.prisma.appointment.findUnique({
      where: { id },
      include: { serviceType: true, vehicle: { select: { ownerUserId: true } } },
    });
```

and before `return this.toDto(updated);`:

```ts
    if (appt.vehicle.ownerUserId) {
      await this.announcements.applyThreadEvent({
        userId: appt.vehicle.ownerUserId, vehicleId: appt.vehicleId, serviceTypeId: appt.serviceTypeId,
        serviceTypeName: appt.serviceType.name, event: { type: "APPOINTMENT_RESCHEDULED" },
        appointmentId: id, scheduledStart: updated.scheduledStart,
      });
    }
```

In `cancel()`, widen the include the same way and add before its `return this.toDto(updated);`:

```ts
    if (appt.vehicle.ownerUserId) {
      await this.announcements.applyThreadEvent({
        userId: appt.vehicle.ownerUserId, vehicleId: appt.vehicleId, serviceTypeId: appt.serviceTypeId,
        serviceTypeName: appt.serviceType.name, event: { type: "APPOINTMENT_CANCELLED" },
      });
    }
```

- [ ] **Step 4: Handle completion**

Find where an appointment transitions to `COMPLETED` (search: `grep -rn '"COMPLETED"' apps/api/src/modules`). At that call site, add the same block with `event: { type: "SERVICE_COMPLETED" }`. If completion happens in `work-orders.service.ts` rather than here, inject `AnnouncementsService` there and add `AnnouncementsModule` to that module's imports.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter api test -- appointments.service.spec`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scheduling/appointments.service.ts apps/api/src/modules/scheduling/appointments.service.spec.ts
git commit -m "feat(scheduling): appointment lifecycle transitions announcement threads"
```

---

## Task 9: T-24h / T-2h appointment reminder job

The PDF promises "The app sends a reminder before the appointment" — nothing does this today.

**Files:**
- Modify: `apps/api/src/modules/scheduling/appointments.service.ts`, `scheduling.scheduler.ts:16-32`, `scheduling.processor.ts:26-36`
- Test: `apps/api/src/modules/scheduling/appointments.service.spec.ts`

**Interfaces:**
- Consumes: `AnnouncementsService.applyThreadEvent`
- Produces: `AppointmentsService.remindUpcoming(now: Date): Promise<{ reminded: number }>`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/scheduling/appointments.service.spec.ts`:

```ts
describe("remindUpcoming", () => {
  const now = new Date("2026-09-11T02:00:00Z");

  it("reminds appointments starting within the next 24 hours", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const prisma: any = {
      appointment: {
        findMany: jest.fn(async () => [{
          id: "ap1", vehicleId: "v1", serviceTypeId: "s1",
          scheduledStart: new Date("2026-09-12T01:00:00Z"),
          serviceType: { name: "Oil Change" },
          vehicle: { ownerUserId: "u1" },
        }]),
      },
    };
    const svc = new AppointmentsService(prisma, {} as any, {} as any, { now: () => now } as any, { applyThreadEvent } as any);

    const result = await svc.remindUpcoming(now);

    expect(result).toEqual({ reminded: 1 });
    expect(applyThreadEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1", vehicleId: "v1", serviceTypeId: "s1",
      event: { type: "APPOINTMENT_REMINDER_DUE" },
    }));
  });

  it("does not remind appointments further out than 24 hours", async () => {
    const applyThreadEvent = jest.fn(async () => undefined);
    const prisma: any = { appointment: { findMany: jest.fn(async () => []) } };
    const svc = new AppointmentsService(prisma, {} as any, {} as any, { now: () => now } as any, { applyThreadEvent } as any);

    expect(await svc.remindUpcoming(now)).toEqual({ reminded: 0 });
    expect(applyThreadEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- appointments.service.spec`
Expected: FAIL — `remindUpcoming is not a function`.

- [ ] **Step 3: Implement the method**

Add to `AppointmentsService` in `apps/api/src/modules/scheduling/appointments.service.ts`:

```ts
  /**
   * In-app half of FR-090's appointment reminders. Runs hourly and sweeps the next 24h; the
   * thread state machine collapses repeats, so an appointment is only ever reminded once.
   */
  async remindUpcoming(now: Date): Promise<{ reminded: number }> {
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const upcoming = await this.prisma.appointment.findMany({
      where: { status: { in: ["BOOKED", "CONFIRMED"] }, scheduledStart: { gt: now, lte: horizon } },
      include: { serviceType: { select: { name: true } }, vehicle: { select: { ownerUserId: true } } },
    });

    let reminded = 0;
    for (const a of upcoming) {
      if (!a.vehicle.ownerUserId) continue;
      await this.announcements.applyThreadEvent({
        userId: a.vehicle.ownerUserId, vehicleId: a.vehicleId, serviceTypeId: a.serviceTypeId,
        serviceTypeName: a.serviceType.name, event: { type: "APPOINTMENT_REMINDER_DUE" },
        appointmentId: a.id, scheduledStart: a.scheduledStart,
      });
      reminded++;
    }
    return { reminded };
  }
```

Check the `status` values against the `ACTIVE_STATUSES` constant already in this file and use the same set rather than re-listing strings if it matches.

- [ ] **Step 4: Register the job**

In `apps/api/src/modules/scheduling/scheduling.scheduler.ts`, add inside `onModuleInit`:

```ts
    await this.queue.upsertJobScheduler(
      "appointments.remindUpcoming",
      { pattern: "0 * * * *", tz: MANILA_TZ },
      { name: "remindUpcoming" },
    );
```

In `apps/api/src/modules/scheduling/scheduling.processor.ts`, add a case:

```ts
      case "remindUpcoming":
        await this.appointments.remindUpcoming(this.clock.now());
        return;
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter api test -- appointments.service.spec`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scheduling/
git commit -m "feat(scheduling): hourly T-24h appointment reminder job"
```

---

## Task 10: Attention feed reads announcements

**Files:**
- Modify: `apps/api/src/modules/attention/attention.service.ts:1-14,25-30,113-128`, `apps/api/src/modules/attention/attention.module.ts`
- Test: `apps/api/test/attention.e2e-spec.ts`

**Interfaces:**
- Consumes: `AnnouncementsService.activeServiceDue` (Task 6)
- Produces: `AttentionService.build()` unchanged in signature and output contract

- [ ] **Step 1: Write the failing test**

In `apps/api/test/attention.e2e-spec.ts`, add a case that seeds an announcement rather than a `ServiceReminder`:

```ts
it("surfaces SERVICE_DUE from an active announcement thread", async () => {
  const st = await prisma.serviceType.create({
    data: { code: `${TAG}-OIL`, name: "Oil Change", standardDurationMin: 45, requiredSkills: ["GENERAL"], priceCentavos: 85000n, intervalDays: 180 },
  });
  await prisma.announcement.create({
    data: {
      userId: memberId, vehicleId, serviceTypeId: st.id, kind: "SERVICE_DUE", status: "ACTIVE",
      title: "Oil Change due", body: "It has been long enough since the last Oil Change to book the next one.", reason: "TIME",
    },
  });

  const res = await request(app.getHttpServer())
    .get("/api/v1/me/attention")
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(200);

  const item = res.body.data.find((i: any) => i.kind === "SERVICE_DUE");
  expect(item).toBeDefined();
  expect(item.title).toContain("Oil Change");
  expect(item.deepLink).toEqual({ screen: "Booking", params: { vehicleId, serviceTypeId: st.id } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- attention.e2e-spec`
Expected: FAIL — the service still reads `serviceReminder`, so no item is found.

- [ ] **Step 3: Rewrite `servicesDue`**

In `apps/api/src/modules/attention/attention.service.ts`, inject the service:

```ts
  constructor(private prisma: PrismaService, private announcements: AnnouncementsService) {}
```

with `import { AnnouncementsService } from "../announcements/announcements.service";`.

Replace the whole `servicesDue` private method:

```ts
  /**
   * Service-due items come from ACTIVE announcement threads (spec §7) — the announcements table
   * is the single source. `publishedAt` is a real due signal, unlike the old ServiceReminder
   * `createdAt` hack, so `overdue` can be computed honestly.
   */
  private async servicesDue(vehicleIds: string[], now: Date): Promise<AttentionInputs["servicesDue"]> {
    const threads = await this.announcements.activeServiceDue(vehicleIds);
    return threads.map((t) => ({
      vehicleId: t.vehicleId,
      serviceTypeId: t.serviceTypeId,
      serviceTypeName: t.serviceTypeName,
      dueDate: t.publishedAt,
      overdue: now.getTime() - t.publishedAt.getTime() >= SERVICE_DUE_WINDOW_DAYS * 86_400_000,
    }));
  }
```

`SERVICE_DUE_WINDOW_DAYS` is already declared at the top of the file and now means "a thread open this long is overdue" — update its comment accordingly.

- [ ] **Step 4: Wire the module**

In `apps/api/src/modules/attention/attention.module.ts`:

```ts
import { AnnouncementsModule } from "../announcements/announcements.module";
```
```ts
@Module({
  imports: [AnnouncementsModule],
  controllers: [AttentionController],
  providers: [AttentionService],
  exports: [AttentionService],
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter api test -- attention`
Expected: PASS. Remove or rewrite any older test in that file that seeded `serviceReminder` directly.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/attention apps/api/test/attention.e2e-spec.ts
git commit -m "refactor(attention): source SERVICE_DUE from announcement threads"
```

---

## Task 11: Drop the ServiceReminder table

Only safe now that Tasks 7 and 10 removed both consumers.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (remove `model ServiceReminder`, remove `Vehicle.serviceReminders`, remove `ServiceType.serviceReminders`)

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Confirm no consumers remain**

Run: `grep -rn "serviceReminder\|ServiceReminder" apps/api/src apps/api/test packages`
Expected: no matches outside `schema.prisma`. If any remain, stop and migrate them first.

- [ ] **Step 2: Remove the model and its back-relations**

Delete `model ServiceReminder { ... }` from `apps/api/prisma/schema.prisma`, plus the line `serviceReminders  ServiceReminder[]` from both `model Vehicle` and `model ServiceType`.

- [ ] **Step 3: Generate and apply the migration**

```bash
docker compose up -d
pnpm --filter api exec prisma migrate dev --name drop-service-reminders
```

- [ ] **Step 4: Verify the suite is green**

Run: `pnpm turbo run typecheck test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "refactor(scheduling): drop service_reminders, replaced by announcement threads"
```

---

## Task 12: Member and admin API endpoints

**Files:**
- Create: `apps/api/src/modules/announcements/announcements.controller.ts`, `admin-announcements.controller.ts`
- Modify: `apps/api/src/modules/announcements/announcements.module.ts`
- Test: `apps/api/test/announcements.e2e-spec.ts`

**Interfaces:**
- Consumes: `AnnouncementsService` (Task 6), `broadcastCreateSchema` (Task 4)
- Produces: `GET /me/announcements`, `POST /announcements/:id/read`, `POST /announcements/read-all`, `POST /announcements/:id/dismiss`, `POST /admin/announcements`, `GET /admin/announcements`, `PATCH /admin/announcements/:id`

- [ ] **Step 1: Write the failing e2e test**

Create `apps/api/test/announcements.e2e-spec.ts`, following the harness in `attention.e2e-spec.ts` (same `seal()` helper, same `TAG` cleanup discipline — never truncate):

```ts
it("returns an empty feed for a member with nothing", async () => {
  const res = await request(app.getHttpServer())
    .get("/api/v1/me/announcements")
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(200);
  expect(res.body.data).toEqual({ items: [], unreadCount: 0 });
});

it("shows an admin broadcast to a member and marks it read", async () => {
  await request(app.getHttpServer())
    .post("/api/v1/admin/announcements")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ title: `${TAG} Holiday hours`, body: "Closed Dec 25." })
    .expect(201);

  const feed = await request(app.getHttpServer())
    .get("/api/v1/me/announcements")
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(200);
  const item = feed.body.data.items.find((i: any) => i.title.includes(TAG));
  expect(item.read).toBe(false);
  expect(feed.body.data.unreadCount).toBeGreaterThan(0);

  await request(app.getHttpServer())
    .post(`/api/v1/announcements/${item.id}/read`)
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(201);

  const after = await request(app.getHttpServer())
    .get("/api/v1/me/announcements")
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(200);
  expect(after.body.data.items.find((i: any) => i.id === item.id).read).toBe(true);
});

it("refuses a broadcast from a member", async () => {
  await request(app.getHttpServer())
    .post("/api/v1/admin/announcements")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({ title: "nope", body: "nope" })
    .expect(403);
});

it("never leaks another member's thread", async () => {
  await prisma.announcement.create({
    data: { userId: otherMemberId, vehicleId: null, serviceTypeId: null, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} private`, body: "x" },
  });
  const res = await request(app.getHttpServer())
    .get("/api/v1/me/announcements")
    .set("Authorization", `Bearer ${memberToken}`)
    .expect(200);
  expect(res.body.data.items.find((i: any) => i.title.includes("private"))).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- announcements.e2e-spec`
Expected: FAIL — 404 on every route.

- [ ] **Step 3: Write the member controller**

Create `apps/api/src/modules/announcements/announcements.controller.ts`:

```ts
import { Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { PrismaService } from "../prisma/prisma.service";
import { AnnouncementsService } from "./announcements.service";

@Controller()
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService, private prisma: PrismaService) {}

  /** The member's threads plus live broadcasts, newest first. */
  @Get("me/announcements")
  async mine(@CurrentUser() u: AbilityUser) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ownerUserId: u.id, status: "ACTIVE" },
      select: { id: true, plateNo: true },
    });
    const plates = new Map(vehicles.map((v) => [v.id, v.plateNo]));
    return this.announcements.feed(u.id, vehicles.length > 1 ? plates : new Map());
  }

  @Post("announcements/:id/read")
  async read(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    await this.announcements.markRead(u.id, id);
    return { ok: true };
  }

  @Post("announcements/read-all")
  async readAll(@CurrentUser() u: AbilityUser) {
    await this.announcements.markAllRead(u.id);
    return { ok: true };
  }

  @Post("announcements/:id/dismiss")
  async dismiss(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    await this.announcements.dismiss(u.id, id);
    return { ok: true };
  }
}
```

- [ ] **Step 4: Write the admin controller**

Create `apps/api/src/modules/announcements/admin-announcements.controller.ts`. Copy the role-guard decorators from `apps/api/src/modules/users/users.controller.ts`'s admin-only routes so the ADMIN restriction matches house convention exactly:

```ts
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { broadcastCreateSchema, type BroadcastCreate } from "@autocare/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { AnnouncementsService } from "./announcements.service";

@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  /** FR-107 — broadcast to all members. Audience segmentation is deferred (spec §12). */
  @Post()
  async create(@CurrentUser() u: AbilityUser, @Body() body: unknown) {
    const dto: BroadcastCreate = broadcastCreateSchema.parse(body);
    await this.announcements.broadcast(u.id, dto);
    return { ok: true };
  }

  @Get()
  list() {
    return this.announcements.listBroadcasts();
  }

  @Patch(":id")
  async unpublish(@Param("id") id: string) {
    await this.announcements.unpublish(id);
    return { ok: true };
  }
}
```

Apply the same ADMIN role guard used by `users.controller.ts` to this class.

- [ ] **Step 5: Register both controllers**

Update `apps/api/src/modules/announcements/announcements.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AnnouncementsService } from "./announcements.service";
import { AnnouncementsController } from "./announcements.controller";
import { AdminAnnouncementsController } from "./admin-announcements.controller";

@Module({
  controllers: [AnnouncementsController, AdminAnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter api test -- announcements.e2e-spec`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/announcements apps/api/test/announcements.e2e-spec.ts
git commit -m "feat(announcements): member feed and admin broadcast endpoints"
```

---

## Task 13: Member Announcements screen

**Files:**
- Create: `apps/member/src/features/announcements/announcementsApi.ts`, `AnnouncementsScreen.tsx`, `AnnouncementsScreen.test.tsx`

**Interfaces:**
- Consumes: `GET /me/announcements`, `POST /announcements/:id/read` (Task 12)
- Produces: `makeAnnouncementsApi(api)`, `AnnouncementsScreen` props `{ items, unreadCount, refreshing, onRefresh, onPressItem, onMarkAllRead }`

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/features/announcements/AnnouncementsScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AnnouncementsScreen } from "./AnnouncementsScreen";
import type { AnnouncementItem } from "./announcementsApi";

const item = (over: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id: "a1", kind: "SERVICE_DUE", status: "ACTIVE", title: "Oil Change due",
  body: "It has been long enough since the last Oil Change to book the next one.",
  vehicleId: "v1", serviceTypeId: "s1", appointmentId: null,
  publishedAt: "2026-09-01T00:00:00.000Z", read: false, ...over,
});

describe("AnnouncementsScreen", () => {
  it("shows an empty state when there is nothing", () => {
    render(<AnnouncementsScreen items={[]} unreadCount={0} refreshing={false} onRefresh={() => {}} onPressItem={() => {}} onMarkAllRead={() => {}} />);
    expect(screen.getByText("No announcements yet")).toBeTruthy();
  });

  it("renders a thread with its title and body", () => {
    render(<AnnouncementsScreen items={[item()]} unreadCount={1} refreshing={false} onRefresh={() => {}} onPressItem={() => {}} onMarkAllRead={() => {}} />);
    expect(screen.getByText("Oil Change due")).toBeTruthy();
    expect(screen.getByTestId("unread-dot-a1")).toBeTruthy();
  });

  it("hides the unread dot once read", () => {
    render(<AnnouncementsScreen items={[item({ read: true })]} unreadCount={0} refreshing={false} onRefresh={() => {}} onPressItem={() => {}} onMarkAllRead={() => {}} />);
    expect(screen.queryByTestId("unread-dot-a1")).toBeNull();
  });

  it("calls onPressItem when a row is tapped", () => {
    const onPressItem = jest.fn();
    render(<AnnouncementsScreen items={[item()]} unreadCount={1} refreshing={false} onRefresh={() => {}} onPressItem={onPressItem} onMarkAllRead={() => {}} />);
    fireEvent.press(screen.getByTestId("announcement-a1"));
    expect(onPressItem).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("offers mark-all-read only when something is unread", () => {
    const { rerender } = render(<AnnouncementsScreen items={[item()]} unreadCount={1} refreshing={false} onRefresh={() => {}} onPressItem={() => {}} onMarkAllRead={() => {}} />);
    expect(screen.getByTestId("mark-all-read")).toBeTruthy();
    rerender(<AnnouncementsScreen items={[item({ read: true })]} unreadCount={0} refreshing={false} onRefresh={() => {}} onPressItem={() => {}} onMarkAllRead={() => {}} />);
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- AnnouncementsScreen`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the api client**

Create `apps/member/src/features/announcements/announcementsApi.ts`:

```ts
import { ApiClient } from "@autocare/api-client";

export type AnnouncementKind =
  | "SERVICE_DUE" | "APPOINTMENT_BOOKED" | "APPOINTMENT_REMINDER"
  | "APPOINTMENT_RESCHEDULED" | "APPOINTMENT_CANCELLED" | "SERVICE_COMPLETED" | "ADMIN_BROADCAST";

export type AnnouncementItem = {
  id: string;
  kind: AnnouncementKind;
  status: "ACTIVE" | "SUPERSEDED" | "DISMISSED";
  title: string;
  body: string;
  vehicleId: string | null;
  plate?: string;
  serviceTypeId: string | null;
  appointmentId: string | null;
  publishedAt: string;
  read: boolean;
};

export type AnnouncementFeed = { items: AnnouncementItem[]; unreadCount: number };

export function makeAnnouncementsApi(api: ApiClient) {
  return {
    mine: () => api.get<AnnouncementFeed>("/me/announcements"),
    markRead: (id: string) => api.post<{ ok: true }>(`/announcements/${id}/read`, {}),
    markAllRead: () => api.post<{ ok: true }>("/announcements/read-all", {}),
  };
}
export type AnnouncementsApi = ReturnType<typeof makeAnnouncementsApi>;
```

- [ ] **Step 4: Write the screen**

Create `apps/member/src/features/announcements/AnnouncementsScreen.tsx`:

```tsx
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { theme } from "../../theme";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { Plate } from "../../components/Plate";
import type { AnnouncementItem } from "./announcementsApi";

function relativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function AnnouncementsScreen({
  items, unreadCount, refreshing, onRefresh, onPressItem, onMarkAllRead,
}: {
  items: AnnouncementItem[];
  unreadCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onPressItem: (item: AnnouncementItem) => void;
  onMarkAllRead: () => void;
}) {
  const t = theme;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>Announcements</Text>
        {unreadCount > 0 && (
          <Pressable testID="mark-all-read" onPress={onMarkAllRead} accessibilityRole="button">
            <Text style={{ ...t.text("label"), color: t.colors.gaugeBlue }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 && (
        <EmptyState title="No announcements yet" body="Service reminders and shop updates will appear here." />
      )}

      {items.map((a) => (
        <Pressable key={a.id} testID={`announcement-${a.id}`} onPress={() => onPressItem(a)} accessibilityRole="button">
          <Card style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.xs }}>
              {!a.read && (
                <View
                  testID={`unread-dot-${a.id}`}
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.gaugeBlue }}
                />
              )}
              <Text style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{a.title}</Text>
              <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{relativeDate(a.publishedAt)}</Text>
            </View>
            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{a.body}</Text>
            {a.plate && <Plate value={a.plate} />}
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

If `EmptyState` takes different prop names, match its existing signature rather than changing the component.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter member test -- AnnouncementsScreen`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/announcements/
git commit -m "feat(member): announcements feed screen"
```

---

## Task 14: Wire announcements into the member app

**Files:**
- Modify: `apps/member/src/app/RootNavigator.tsx`, `apps/member/src/features/account/AccountScreen.tsx`
- Test: `apps/member/src/features/account/AccountScreen.test.tsx`

**Interfaces:**
- Consumes: `AnnouncementsScreen`, `makeAnnouncementsApi` (Task 13)
- Produces: `Announcements` route; `AccountScreen` prop `onAnnouncements: () => void` and optional `unreadAnnouncements?: number`

- [ ] **Step 1: Write the failing test**

Append to `apps/member/src/features/account/AccountScreen.test.tsx`:

```tsx
it("navigates to announcements from the account list", () => {
  const onAnnouncements = jest.fn();
  renderAccount({ onAnnouncements });          // use this file's existing render helper
  fireEvent.press(screen.getByTestId("row-announcements"));
  expect(onAnnouncements).toHaveBeenCalled();
});

it("shows an unread badge when announcements are waiting", () => {
  renderAccount({ unreadAnnouncements: 3 });
  expect(screen.getByText("3")).toBeTruthy();
});
```

Extend the file's existing render helper to pass the two new props through with sensible defaults (`onAnnouncements: () => {}`, `unreadAnnouncements: 0`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test -- AccountScreen`
Expected: FAIL — no `row-announcements` testID.

- [ ] **Step 3: Add the row**

In `apps/member/src/features/account/AccountScreen.tsx`, add the two props to the component's prop type and destructure, then render the row above `row-personal` (line ~188):

```tsx
        <Row testID="row-announcements" label="Announcements" badge={unreadAnnouncements} onPress={onAnnouncements} />
```

Extend the local `Row` helper (line 55) to accept and render an optional count badge:

```tsx
function Row({ label, onPress, testID, badge }: { label: string; onPress: () => void; testID?: string; badge?: number }) {
```

and, immediately before the existing chevron `<Icon />`, render:

```tsx
      {badge ? (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: t.colors.gaugeBlue, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{badge}</Text>
        </View>
      ) : null}
```

- [ ] **Step 4: Add the route and container**

In `apps/member/src/app/RootNavigator.tsx`, add these imports:

```tsx
import { AnnouncementsScreen } from "../features/announcements/AnnouncementsScreen";
import { makeAnnouncementsApi, type AnnouncementFeed } from "../features/announcements/announcementsApi";
```

then a container modelled on `AttentionContainer` (line 305):

```tsx
function AnnouncementsContainer({ navigation }: any) {
  const [feed, setFeed] = useState<AnnouncementFeed>({ items: [], unreadCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setFeed(await announcementsApi.mine());
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  return (
    <AnnouncementsScreen
      items={feed.items}
      unreadCount={feed.unreadCount}
      refreshing={refreshing}
      onRefresh={() => load().catch(() => undefined)}
      onMarkAllRead={() => announcementsApi.markAllRead().then(load).catch(() => undefined)}
      onPressItem={(item) => {
        announcementsApi.markRead(item.id).catch(() => undefined);
        if (item.vehicleId && item.serviceTypeId) {
          navigation.navigate("Booking", { vehicleId: item.vehicleId, serviceTypeId: item.serviceTypeId });
        }
      }}
    />
  );
}
```

Register the screen next to the other stack entries (line ~877):

```tsx
      <Stack.Screen name="Announcements" component={AnnouncementsContainer} />
```

Construct `announcementsApi` where the other feature APIs are constructed in this file, using `makeAnnouncementsApi(api)`.

In `AccountTabContainer` (line 431), pass:

```tsx
      onAnnouncements={() => parent().navigate("Announcements")}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter member test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/member/src
git commit -m "feat(member): announcements route and account entry point"
```

---

## Task 15: Admin broadcast console (A-16)

**Files:**
- Create: `apps/web/lib/announcements/api.ts`, `apps/web/app/admin/announcements/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: `POST/GET/PATCH /admin/announcements` (Task 12)
- Produces: `getBroadcasts()`, `createBroadcast(dto)`, `unpublishBroadcast(id)`; the `/admin/announcements` page

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/admin/announcements/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AnnouncementsAdminPage from "./page";

vi.mock("../../../lib/announcements/api", () => ({
  getBroadcasts: vi.fn(async () => []),
  createBroadcast: vi.fn(async () => ({ ok: true })),
  unpublishBroadcast: vi.fn(async () => ({ ok: true })),
}));

import { getBroadcasts, createBroadcast } from "../../../lib/announcements/api";

describe("AnnouncementsAdminPage", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("loads existing broadcasts on mount", async () => {
    (getBroadcasts as any).mockResolvedValueOnce([
      { id: "a1", title: "Holiday hours", body: "Closed Dec 25.", status: "ACTIVE", publishedAt: "2026-09-01T00:00:00.000Z" },
    ]);
    render(<AnnouncementsAdminPage />);
    expect(await screen.findByText("Holiday hours")).toBeTruthy();
  });

  it("submits a new broadcast", async () => {
    render(<AnnouncementsAdminPage />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Typhoon closure" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Closed today." } });
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => {
      expect(createBroadcast).toHaveBeenCalledWith({ title: "Typhoon closure", body: "Closed today." });
    });
  });

  it("refuses to submit an empty form", async () => {
    render(<AnnouncementsAdminPage />);
    fireEvent.click(screen.getByRole("button", { name: /publish/i }));
    await waitFor(() => { expect(createBroadcast).not.toHaveBeenCalled(); });
  });
});
```

Add `app/admin/**` to the `include` array in `apps/web/vitest.config.ts` if page tests are not already covered there.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- announcements`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the api wrapper**

Create `apps/web/lib/announcements/api.ts`, matching the fetch/error-handling shape of `apps/web/lib/users/api.ts` (all calls go through the BFF proxy at `/api/proxy/...`):

```ts
export type Broadcast = {
  id: string;
  title: string;
  body: string;
  status: "ACTIVE" | "SUPERSEDED" | "DISMISSED";
  publishedAt: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json.data as T;
}

export const getBroadcasts = () => call<Broadcast[]>("/admin/announcements");
export const createBroadcast = (dto: { title: string; body: string }) =>
  call<{ ok: true }>("/admin/announcements", { method: "POST", body: JSON.stringify(dto) });
export const unpublishBroadcast = (id: string) =>
  call<{ ok: true }>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify({}) });
```

- [ ] **Step 4: Write the page**

Create `apps/web/app/admin/announcements/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { getBroadcasts, createBroadcast, unpublishBroadcast, type Broadcast } from "../../../lib/announcements/api";
import { Button } from "../../../components/Button";

/**
 * A-16 — FR-107 broadcast console. Audience is every member for v1; segmentation is
 * deferred (see the design spec §12), so there is deliberately no audience picker yet.
 */
export default function AnnouncementsAdminPage() {
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setRows(await getBroadcasts()); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed to load announcements"); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) { setErr("Title and message are both required."); return; }
    setBusy(true);
    setErr(null);
    try {
      await createBroadcast({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Announcements</h1>
      {err && <p role="alert" className="text-danger">{err}</p>}

      <section className="space-y-3 max-w-xl">
        <label className="block" htmlFor="title">Title</label>
        <input id="title" aria-label="Title" className="w-full border rounded px-3 py-2"
          value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="block" htmlFor="body">Message</label>
        <textarea id="body" aria-label="Message" rows={4} className="w-full border rounded px-3 py-2"
          value={body} onChange={(e) => setBody(e.target.value)} />

        <Button onClick={publish} disabled={busy}>Publish to all members</Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Published</h2>
        {rows.length === 0 && <p>No announcements yet.</p>}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border rounded p-3 flex justify-between items-start gap-4">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-sm opacity-80">{r.body}</p>
                <p className="text-xs opacity-60">{new Date(r.publishedAt).toLocaleString()} · {r.status}</p>
              </div>
              {r.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => unpublishBroadcast(r.id).then(refresh)}>Unpublish</Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

Match `Button`'s actual variant prop values; if it has no `secondary` variant, use the one the codebase already uses for low-emphasis actions.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter web test -- announcements`
Expected: PASS

- [ ] **Step 6: Full verification**

Run: `pnpm turbo run typecheck lint test`
Expected: all packages green.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): A-16 admin announcement broadcast console"
```

---

## Verification checklist

After Task 15, confirm against the spec:

- [ ] `pnpm turbo run typecheck lint test` is green across all packages
- [ ] Seeded service types all carry an interval (Task 1 test)
- [ ] `grep -rn "serviceReminder" apps/api` returns nothing (Task 11)
- [ ] The partial index exists and is scoped to `ACTIVE` (Task 3 test)
- [ ] Booking a service transitions its due thread rather than creating a second row
- [ ] A cancelled appointment returns the thread to `SERVICE_DUE`
- [ ] The attention dashboard still shows service-due items, now sourced from announcements

**Owed manual verification** (cannot run headless here, consistent with prior phases):
- On-device Expo check of the Announcements screen and the Account unread badge
- `/admin/announcements` against a live API session in a browser
