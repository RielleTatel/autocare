# Phase 3 — Scheduling & Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Expanded from draft 2026-08-23** (was DRAFT since 2026-08-08). The capacity-engine signature and hold protocol were already settled in the draft; everything below is now step-level and executable.

**Goal:** Members book real, capacity-checked appointment slots that consume plan entitlements; advisors run the day from a schedule board; the system never sells a slot it cannot service.

**Architecture:** A pure `capacity-engine.ts` kernel computes bookable slots from a two-resource constraint (a bay with the right capability **and** a mechanic on shift with the required skill). A thin `SchedulingService` loads DB inputs, runs the kernel, and subtracts live Redis holds. Holds are short-lived Redis keys (`SET NX EX`); booking atomically converts a hold into an `Appointment` row inside a Prisma transaction while consuming a Phase-2 entitlement. Time-driven work (no-show flagging, due-service reminders) runs as BullMQ scheduled jobs following the existing `billing.scheduler`/`billing.processor` pattern. The advisor board (Next.js) and member booking flow (Expo) consume the same endpoints.

**Tech Stack:** NestJS 10, Prisma (Postgres on **Supabase** — see DB note), Redis via `ioredis` (new raw client) + BullMQ (`@nestjs/bullmq`), Zod contracts (`@autocare/contracts`), Next.js app-router (`apps/web`), React Native/Expo (`apps/member`), Jest (API, real-DB e2e), Vitest + Playwright (web), Jest + RTL (member).

**Spec:** `AutoCare+ Docs/` vault, module M4 (FR-041→FR-052), Architecture §7.7. Roadmap: `docs/superpowers/plans/2026-08-08-autocare-roadmap.md`.

## Global Constraints

- **Database is Supabase Postgres.** `apps/api/.env` `DATABASE_URL` points at the hosted Supabase instance (`db.jtqdzvgseziazhgyhdwh.supabase.co`). Migrations author + apply against it. Because `prisma migrate dev` needs a shadow DB and the Supabase role may not permit `CREATE DATABASE`, add `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` to the datasource block (Task 1, Step 1) and point `SHADOW_DATABASE_URL` at the still-running local Docker Postgres (`postgresql://autocare:autocare@localhost:5432/autocare`). Real migrations land on Supabase; the shadow stays local.
- **Real-DB tests share the Supabase DB.** Every e2e/real-DB spec MUST scope its cleanup to its own fixtures using a unique per-suite prefix (e.g. `SCHED-<uuid8>` plan codes, `sched-<uuid8>` firebase UIDs, plate prefixes). NEVER truncate a table or `deleteMany` without a fixture-scoped `where`. This mirrors `test/billing.e2e-spec.ts` and is non-negotiable now that the test DB holds potentially real data.
- **Timezone is `Asia/Manila`** for all slot arithmetic and cron schedules. Reuse the `MANILA_TZ = "Asia/Manila"` convention from `billing.scheduler.ts`. Slot times are stored/compared as `HH:mm` strings within a day plus a `YYYY-MM-DD` date; the engine does string/minute arithmetic (no DST in PH, so no offset math).
- **Never call `new Date()` in job/booking logic** — inject the clock via `@Inject(CLOCK)` (`src/common/clock/clock.ts`), so tests drive a deterministic timeline (existing pattern from billing).
- **Entitlement consumption goes through Phase 2** — `EntitlementService.consume(subscriptionId, type, qty, sourceRef?)` returns `{ ok: true } | { ok: false; reason: "EXHAUSTED"; overagePriceCentavos } | { ok: false; reason: "SUSPENDED" }`. `EntitlementType` values: `INSPECTION | PICKUP | ROADSIDE | OIL_CHANGE | TIRE_ROTATION`. Do not re-implement quota logic.
- **Error envelope + codes** — throw `new DomainError(code, message, httpStatus)` (`src/common/errors/domain-error.ts`). Reuse existing codes from `packages/contracts/src/errors.ts`: `SLOT_UNAVAILABLE`, `CAPACITY_EXCEEDED`, `ENTITLEMENT_EXHAUSTED`, `SUBSCRIPTION_SUSPENDED`, `FORBIDDEN_ROLE`. Add new codes only where noted (Task 4).
- **Auth/authz** — controllers read the caller via `@CurrentUser() u: AbilityUser` and gate with the CASL ability factory (`src/common/policies/ability.factory.ts`), same as `VehiclesController`. Advisor/admin-only endpoints check `u.role`.
- **Validation** — request bodies validated with `new ZodValidationPipe(schema)` against schemas in `packages/contracts/src/scheduling.ts`.
- **NFR-005:** a 30-day slot-availability query must return in ≤ 800 ms. Precompute/query per-day; never scan all appointments per request.
- **DRY / YAGNI / TDD / frequent commits.** Pure logic gets exhaustive unit tests before endpoints. Commit after each green step group.

---

## File Structure

**API (`apps/api`):**
- `prisma/schema.prisma` — add scheduling models + enums (Task 1).
- `src/common/redis/redis.module.ts`, `redis.service.ts` — raw `ioredis` client for holds (Task 3). New; currently only BullMQ touches Redis.
- `src/modules/scheduling/capacity-engine.ts` — pure kernel (Task 2).
- `src/modules/scheduling/capacity-engine.spec.ts` — golden unit tests (Task 2).
- `src/modules/scheduling/scheduling.service.ts` — loads inputs, runs engine, subtracts holds (Tasks 3).
- `src/modules/scheduling/holds.service.ts` — Redis hold acquire/release (Task 3).
- `src/modules/scheduling/appointments.service.ts` — book/reschedule/cancel + entitlement (Task 4).
- `src/modules/scheduling/appointments.controller.ts`, `scheduling.controller.ts` — HTTP (Tasks 3, 4).
- `src/modules/scheduling/reminders.service.ts`, `scheduling.processor.ts`, `scheduling.scheduler.ts` — jobs (Tasks 4 no-show, 5 reminders).
- `src/modules/scheduling/utilisation.service.ts` + admin controller wiring (Task 8).
- `src/modules/scheduling/scheduling.module.ts` — wires the module; imported in `src/app.module.ts`.
- `test/scheduling.e2e-spec.ts`, `test/appointments.e2e-spec.ts` — real-DB e2e (Tasks 3, 4).
- `test/setup-env.ts` — add `SHADOW_DATABASE_URL` note (Task 1).

**Contracts (`packages/contracts`):**
- `src/scheduling.ts` — Zod schemas + inferred types; exported from `src/index.ts` (Task 1).

**Web (`apps/web`):**
- `app/staff/schedule/page.tsx` + `components/schedule/*` — board (Task 6).
- `app/staff/config/page.tsx` — bays/shifts/holidays/buffer editor, A-06/A-07 (Task 6).
- `lib/scheduling/api.ts` — typed fetchers (Task 6).
- `e2e/schedule.spec.ts` — Playwright (Task 6).

**Member (`apps/member`):**
- `src/features/booking/` — screens M-19→M-23, `bookingApi.ts` (Task 7).
- `src/features/home/` — odometer quick-entry M-32 wiring (Task 5/7).

---

## Task 1: Schema, enums, and contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (datasource `shadowDatabaseUrl`; new enums + models)
- Create migration: `apps/api/prisma/migrations/<ts>_add_scheduling_capacity/`
- Create: `packages/contracts/src/scheduling.ts`
- Modify: `packages/contracts/src/index.ts`
- Create test: `packages/contracts/src/scheduling.test.ts`

**Interfaces:**
- Produces (Prisma models): `ServiceBay`, `StaffShift`, `ServiceType`, `Appointment`, `CapacityBlock`, `OperatingHours`; enums `AppointmentStatus { BOOKED CONFIRMED IN_PROGRESS COMPLETED CANCELLED NO_SHOW }`, `Weekday { MON TUE WED THU FRI SAT SUN }`.
- Produces (contracts): `slotQuerySchema`/`SlotQuery`, `holdCreateSchema`/`HoldCreate`, `appointmentCreateSchema`/`AppointmentCreate`, `rescheduleSchema`/`Reschedule`, `serviceTypeSchema`, `baySchema`, `shiftSchema`, `blockSchema`, `operatingHoursSchema`.

- [ ] **Step 1: Add shadow DB to datasource block**

In `apps/api/prisma/schema.prisma`:
```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```
Add to `apps/api/.env` (not committed): `SHADOW_DATABASE_URL=postgresql://autocare:autocare@localhost:5432/autocare`. Ensure local Docker Postgres is up (`docker ps` shows `autocare-postgres-1`).

- [ ] **Step 2: Add enums + models to schema**

Append to `apps/api/prisma/schema.prisma`:
```prisma
enum AppointmentStatus {
  BOOKED
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum Weekday {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}

model ServiceType {
  id                  String        @id @default(uuid()) @db.Uuid
  code                String        @unique
  name                String
  standardDurationMin Int           @map("standard_duration_min")
  requiredSkills      String[]      @map("required_skills")
  priceCentavos       BigInt        @map("price_centavos")
  entitlementType     EntitlementType? @map("entitlement_type")
  intervalDays        Int?          @map("interval_days")
  intervalKm          Int?          @map("interval_km")
  isActive            Boolean       @default(true) @map("is_active")
  createdAt           DateTime      @default(now()) @map("created_at")
  appointments        Appointment[]
  @@map("service_types")
}

model ServiceBay {
  id           String    @id @default(uuid()) @db.Uuid
  name         String    @unique
  capabilities String[]
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  @@map("service_bays")
}

model StaffShift {
  id        String  @id @default(uuid()) @db.Uuid
  userId    String  @map("user_id") @db.Uuid
  date      String  // YYYY-MM-DD, Asia/Manila
  startTime String  @map("start_time") // HH:mm
  endTime   String  @map("end_time")   // HH:mm
  skills    String[]
  user      User    @relation(fields: [userId], references: [id])
  @@index([date])
  @@map("staff_shifts")
}

model OperatingHours {
  id          String   @id @default(uuid()) @db.Uuid
  weekday     Weekday? // null when this row is a holiday/date override
  dateOverride String? @map("date_override") // YYYY-MM-DD; when set, overrides weekday for that date
  openTime    String?  @map("open_time")  // HH:mm; null = closed
  closeTime   String?  @map("close_time") // HH:mm; null = closed
  walkInBufferPct Int  @default(0) @map("walk_in_buffer_pct")
  @@unique([weekday])
  @@unique([dateOverride])
  @@map("operating_hours")
}

model CapacityBlock {
  id        String   @id @default(uuid()) @db.Uuid
  bayId     String?  @map("bay_id") @db.Uuid // null = whole-shop block (holiday, all bays)
  date      String   // YYYY-MM-DD
  startTime String   @map("start_time") // HH:mm
  endTime   String   @map("end_time")   // HH:mm
  reason    String
  createdBy String   @map("created_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  @@index([date])
  @@map("capacity_blocks")
}

model Appointment {
  id             String            @id @default(uuid()) @db.Uuid
  vehicleId      String            @map("vehicle_id") @db.Uuid
  serviceTypeId  String            @map("service_type_id") @db.Uuid
  bayId          String?           @map("bay_id") @db.Uuid
  scheduledStart DateTime          @map("scheduled_start")
  scheduledEnd   DateTime          @map("scheduled_end")
  status         AppointmentStatus @default(BOOKED)
  requiresPickup Boolean           @default(false) @map("requires_pickup")
  createdBy      String            @map("created_by") @db.Uuid
  subscriptionId String?           @map("subscription_id") @db.Uuid
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")
  vehicle        Vehicle           @relation(fields: [vehicleId], references: [id])
  serviceType    ServiceType       @relation(fields: [serviceTypeId], references: [id])
  @@index([scheduledStart, bayId])
  @@index([status, scheduledStart])
  @@map("appointments")
}
```
Add the back-relations on existing models: on `User` add `shifts StaffShift[]`; on `Vehicle` add `appointments Appointment[]`.

- [ ] **Step 3: Author + apply the migration against Supabase**

Run:
```bash
cd apps/api
pnpm exec prisma migrate dev --name add_scheduling_capacity
```
Expected: shadow DB validates on local Docker, migration applies to Supabase, `prisma generate` runs. Verify with `pnpm exec prisma migrate status` (Supabase up to date).

- [ ] **Step 4: Write failing contracts test**

Create `packages/contracts/src/scheduling.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { slotQuerySchema, holdCreateSchema, appointmentCreateSchema, rescheduleSchema } from "./scheduling";

describe("scheduling contracts", () => {
  it("accepts a valid slot query", () => {
    const p = slotQuerySchema.parse({ from: "2026-09-01", to: "2026-09-07", serviceTypeId: "11111111-1111-1111-1111-111111111111" });
    expect(p.from).toBe("2026-09-01");
  });
  it("rejects a slot window wider than 30 days", () => {
    expect(() => slotQuerySchema.parse({ from: "2026-09-01", to: "2026-10-15", serviceTypeId: "11111111-1111-1111-1111-111111111111" })).toThrow();
  });
  it("requires an ISO start on a hold", () => {
    expect(() => holdCreateSchema.parse({ bayId: "x", start: "nope", serviceTypeId: "y" })).toThrow();
  });
  it("accepts an appointment create with a hold id", () => {
    const p = appointmentCreateSchema.parse({ holdId: "bay1|2026-09-01T09:00:00+08:00", vehicleId: "11111111-1111-1111-1111-111111111111", serviceTypeId: "22222222-2222-2222-2222-222222222222", requiresPickup: false });
    expect(p.requiresPickup).toBe(false);
  });
  it("reschedule requires a new hold id", () => {
    expect(() => rescheduleSchema.parse({})).toThrow();
  });
});
```

- [ ] **Step 5: Run it, expect failure**

Run: `pnpm --filter @autocare/contracts test -- scheduling`
Expected: FAIL (`Cannot find module './scheduling'`).

- [ ] **Step 6: Implement contracts**

Create `packages/contracts/src/scheduling.ts`:
```typescript
import { z } from "zod";

const yyyymmdd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:mm");
const iso = z.string().datetime({ offset: true });

export const slotQuerySchema = z
  .object({ from: yyyymmdd, to: yyyymmdd, serviceTypeId: z.string().uuid() })
  .refine((v) => {
    const days = (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000;
    return days >= 0 && days <= 30;
  }, "window must be 0..30 days");
export type SlotQuery = z.infer<typeof slotQuerySchema>;

export const holdCreateSchema = z.object({ bayId: z.string(), start: iso, serviceTypeId: z.string() });
export type HoldCreate = z.infer<typeof holdCreateSchema>;

export const appointmentCreateSchema = z.object({
  holdId: z.string(),
  vehicleId: z.string().uuid(),
  serviceTypeId: z.string().uuid(),
  requiresPickup: z.boolean().default(false),
});
export type AppointmentCreate = z.infer<typeof appointmentCreateSchema>;

export const rescheduleSchema = z.object({ holdId: z.string() });
export type Reschedule = z.infer<typeof rescheduleSchema>;

export const serviceTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  standardDurationMin: z.number().int().positive(),
  requiredSkills: z.array(z.string()).default([]),
  priceCentavos: z.number().int().nonnegative(),
  entitlementType: z.enum(["INSPECTION", "PICKUP", "ROADSIDE", "OIL_CHANGE", "TIRE_ROTATION"]).nullable().optional(),
  intervalDays: z.number().int().positive().nullable().optional(),
  intervalKm: z.number().int().positive().nullable().optional(),
});
export type ServiceTypeInput = z.infer<typeof serviceTypeSchema>;

export const baySchema = z.object({ name: z.string().min(1), capabilities: z.array(z.string()).default([]), isActive: z.boolean().default(true) });
export const shiftSchema = z.object({ userId: z.string().uuid(), date: yyyymmdd, startTime: hhmm, endTime: hhmm, skills: z.array(z.string()).default([]) });
export const blockSchema = z.object({ bayId: z.string().uuid().nullable().optional(), date: yyyymmdd, startTime: hhmm, endTime: hhmm, reason: z.string().min(1) });
export const operatingHoursSchema = z.object({
  weekday: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]).nullable().optional(),
  dateOverride: yyyymmdd.nullable().optional(),
  openTime: hhmm.nullable().optional(),
  closeTime: hhmm.nullable().optional(),
  walkInBufferPct: z.number().int().min(0).max(100).default(0),
});
```
Add to `packages/contracts/src/index.ts`: `export * from "./scheduling";`

- [ ] **Step 7: Run contracts test, expect pass**

Run: `pnpm --filter @autocare/contracts test -- scheduling`
Expected: PASS (5 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma packages/contracts
git commit -m "feat(scheduling): capacity schema + scheduling contracts (FR-041..052)"
```

---

## Task 2: Capacity engine (pure kernel)

**Files:**
- Create: `apps/api/src/modules/scheduling/capacity-engine.ts`
- Create test: `apps/api/src/modules/scheduling/capacity-engine.spec.ts`

**Interfaces:**
- Consumes: nothing (pure). Time is passed in as strings.
- Produces: `availableSlots(i: CapacityInputs): Slot[]` and the `CapacityInputs`/`Slot` types below. Consumed by `SchedulingService` (Task 3).

```typescript
export interface CapacityInputs {
  date: string;                      // YYYY-MM-DD (Asia/Manila)
  serviceType: { durationMin: number; requiredSkills: string[] };
  operatingWindow: { open: string; close: string } | null;  // HH:mm; null = closed
  bays: Array<{ id: string; capabilities: string[] }>;
  blocks: Array<{ bayId: string | null; start: string; end: string }>;   // HH:mm
  shifts: Array<{ mechanicId: string; start: string; end: string; skills: string[] }>; // HH:mm
  appointments: Array<{ bayId: string; start: string; end: string }>;    // HH:mm
  holds: Array<{ bayId: string; start: string; end: string }>;           // HH:mm
  walkInBufferPct: number;           // 0..100
}
export interface Slot { start: string; end: string; bayId: string }  // HH:mm
```

**Algorithm (encode exactly):** convert `HH:mm`→minutes; step the operating window in `durationMin` increments; for each `(slotStart, bay)`: bay must have all `requiredSkills`? no — bay provides *capabilities*, service needs its capability set to be a subset of bay capabilities (treat `requiredSkills` on the service as the capability requirement for the bay AND the skill requirement for the mechanic; a bay is eligible if `requiredSkills ⊆ bay.capabilities`). Then: not overlapped by a block for that bay (or a whole-shop `bayId===null` block), no appointment or hold overlap on that bay. A candidate `(slot, bay)` also requires **≥1 mechanic** whose shift covers `[slotStart, slotEnd)` and whose `skills ⊇ requiredSkills` and who is not already committed — enforce by counting: at any instant the number of concurrent booked slots must not exceed the number of qualified mechanics available then. Finally, drop the last `ceil(count * walkInBufferPct/100)` surviving slots of the day (latest-start first) to withhold walk-in buffer. Return sorted by `start` then `bayId`.

- [ ] **Step 1: Write failing golden tests**

Create `apps/api/src/modules/scheduling/capacity-engine.spec.ts`:
```typescript
import { availableSlots, CapacityInputs } from "./capacity-engine";

const base: CapacityInputs = {
  date: "2026-09-01",
  serviceType: { durationMin: 60, requiredSkills: ["OIL"] },
  operatingWindow: { open: "09:00", close: "12:00" },
  bays: [{ id: "bay1", capabilities: ["OIL", "TIRE"] }],
  blocks: [],
  shifts: [{ mechanicId: "m1", start: "09:00", end: "12:00", skills: ["OIL"] }],
  appointments: [],
  holds: [],
  walkInBufferPct: 0,
};

describe("availableSlots", () => {
  it("returns hourly slots across the window", () => {
    const s = availableSlots(base);
    expect(s.map((x) => x.start)).toEqual(["09:00", "10:00", "11:00"]);
  });
  it("closed day yields no slots", () => {
    expect(availableSlots({ ...base, operatingWindow: null })).toEqual([]);
  });
  it("a whole-shop block removes overlapping slots", () => {
    const s = availableSlots({ ...base, blocks: [{ bayId: null, start: "10:00", end: "11:00" }] });
    expect(s.map((x) => x.start)).toEqual(["09:00", "11:00"]);
  });
  it("a bay without the capability is not usable", () => {
    expect(availableSlots({ ...base, bays: [{ id: "bay1", capabilities: ["TIRE"] }] })).toEqual([]);
  });
  it("no skilled mechanic on shift closes the slot even with a free bay", () => {
    expect(availableSlots({ ...base, shifts: [{ mechanicId: "m1", start: "09:00", end: "12:00", skills: ["TIRE"] }] })).toEqual([]);
  });
  it("an existing appointment excludes its slot on that bay", () => {
    const s = availableSlots({ ...base, appointments: [{ bayId: "bay1", start: "10:00", end: "11:00" }] });
    expect(s.map((x) => x.start)).toEqual(["09:00", "11:00"]);
  });
  it("a hold excludes its slot", () => {
    const s = availableSlots({ ...base, holds: [{ bayId: "bay1", start: "09:00", end: "10:00" }] });
    expect(s.map((x) => x.start)).toEqual(["10:00", "11:00"]);
  });
  it("one mechanic, two bays: concurrency capped at 1 per instant", () => {
    const s = availableSlots({ ...base, bays: [{ id: "bay1", capabilities: ["OIL"] }, { id: "bay2", capabilities: ["OIL"] }] });
    // 3 start-times, but only 1 mechanic → at most one bay usable per start-time
    const byStart = new Map<string, number>();
    for (const x of s) byStart.set(x.start, (byStart.get(x.start) ?? 0) + 1);
    expect([...byStart.values()].every((n) => n === 1)).toBe(true);
  });
  it("walk-in buffer withholds the last slots", () => {
    const s = availableSlots({ ...base, walkInBufferPct: 40 }); // ceil(3*0.4)=2 withheld
    expect(s.map((x) => x.start)).toEqual(["09:00"]);
  });
});
```

- [ ] **Step 2: Run, expect failure** — `pnpm --filter api test -- capacity-engine` → FAIL (module not found).

- [ ] **Step 3: Implement the engine**

Create `apps/api/src/modules/scheduling/capacity-engine.ts` implementing the algorithm above (minute helpers `toMin`/`toHHMM`; `overlaps(aS,aE,bS,bE)= aS<bE && bS<aE`; `subset(a,b)=a.every(x=>b.includes(x))`; build candidate `(start,bay)` list, filter by capability/blocks/appointments/holds, then greedily assign mechanics per start-time capping concurrency at qualified-mechanic count, then apply buffer drop). Keep it pure and allocation-light.

- [ ] **Step 4: Run, expect pass** — `pnpm --filter api test -- capacity-engine` → PASS (all cases).

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/modules/scheduling/capacity-engine.ts apps/api/src/modules/scheduling/capacity-engine.spec.ts
git commit -m "feat(scheduling): pure capacity engine with golden tests (§7.7)"
```

---

## Task 3: Redis holds + slot query endpoint (FR-041→FR-043)

**Files:**
- Create: `apps/api/src/common/redis/redis.module.ts`, `redis.service.ts`
- Create: `apps/api/src/modules/scheduling/holds.service.ts`, `scheduling.service.ts`, `scheduling.controller.ts`, `scheduling.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `SchedulingModule`)
- Create test: `apps/api/test/scheduling.e2e-spec.ts`

**Interfaces:**
- Consumes: `availableSlots` (Task 2); `PrismaService`; `CLOCK`.
- Produces: `RedisService.client: Redis`; `HoldsService.acquire(bayId, startIso, serviceTypeId, userId): Promise<{ holdId: string }>` (throws `DomainError("SLOT_UNAVAILABLE", …, 409)` on conflict), `HoldsService.release(holdId, userId)`, `HoldsService.activeHoldsForDate(date): Promise<Array<{bayId,start,end}>>`; `SchedulingService.slots(query: SlotQuery): Promise<Slot[]>` used by Task 4/6/7. Hold id format: `` `${bayId}|${startIso}` ``. Redis key: `hold:{bayId}:{startIso}`, value `userId`, `NX EX 600`.

- [ ] **Step 1: Redis client provider**

`redis.service.ts`:
```typescript
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  onModuleDestroy() { this.client.disconnect(); }
}
```
`redis.module.ts`: `@Global()` module providing + exporting `RedisService`.

- [ ] **Step 2: Write failing e2e for the hold race + slot query**

Create `apps/api/test/scheduling.e2e-spec.ts` (fixture prefix `sched-`; seed 1 bay, 1 service type, operating hours, 1 mechanic shift; scoped `afterAll` cleanup). Assert:
```typescript
it("lists slots for a day", async () => {
  const res = await as("sched-adv").get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`).expect(200);
  expect(res.body.data.length).toBeGreaterThan(0);
});
it("two racing holds on one slot: exactly one wins", async () => {
  const slot = { bayId, start: startIso, serviceTypeId };
  const [a, b] = await Promise.allSettled([
    as("sched-m1").post("/api/v1/scheduling/holds").send(slot),
    as("sched-m2").post("/api/v1/scheduling/holds").send(slot),
  ]);
  const oks = [a, b].filter((r) => r.status === "fulfilled" && (r as any).value.status === 201);
  expect(oks).toHaveLength(1);
});
it("a held slot disappears from availability", async () => {
  const res = await as("sched-adv").get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`).expect(200);
  expect(res.body.data.find((s: any) => s.start === startIso)).toBeUndefined();
});
```

- [ ] **Step 3: Run, expect failure** — route 404.

- [ ] **Step 4: Implement holds + service + controller**

`HoldsService.acquire` → `client.set(key, userId, "EX", 600, "NX")`; `null` reply → `throw new DomainError("SLOT_UNAVAILABLE", "slot already held", 409)`. `SchedulingService.slots` loads per-day inputs (bays, shifts for date, operating hours incl. `dateOverride`, blocks, appointments where `status in (BOOKED,CONFIRMED,IN_PROGRESS)`, active holds), runs `availableSlots` per day in `[from,to]`, maps `HH:mm`→ISO `+08:00`, returns flat list. `scheduling.controller.ts`:
```typescript
@Controller("scheduling")
export class SchedulingController {
  constructor(private scheduling: SchedulingService, private holds: HoldsService) {}
  @Get("slots") slots(@Query(new ZodValidationPipe(slotQuerySchema)) q: SlotQuery) { return this.scheduling.slots(q); }
  @Post("holds") hold(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(holdCreateSchema)) b: HoldCreate) { return this.holds.acquire(b.bayId, b.start, b.serviceTypeId, u.id); }
  @Delete("holds/:id") release(@CurrentUser() u: AbilityUser, @Param("id") id: string) { return this.holds.release(id, u.id); }
}
```
Register `SchedulingModule` (imports `RedisModule`, `PrismaModule`) in `app.module.ts`.

- [ ] **Step 5: Run, expect pass.**

- [ ] **Step 6: Perf check (NFR-005)** — add a test seeding 2 bays × 30 days of shifts and assert a 30-day `slots` query resolves under 800 ms (`const t=Date.now(); …; expect(Date.now()-t).toBeLessThan(800)`).

- [ ] **Step 7: Commit** — `feat(scheduling): redis holds + slot query endpoint (FR-041..043)`.

---

## Task 4: Appointments — book / reschedule / cancel / no-show (FR-044→FR-046)

**Files:**
- Create: `apps/api/src/modules/scheduling/appointments.service.ts`, `appointments.controller.ts`
- Create: `apps/api/src/modules/scheduling/scheduling.processor.ts`, `scheduling.scheduler.ts`
- Modify: `apps/api/src/modules/scheduling/scheduling.module.ts`, `src/common/queue/queue.module.ts` (register `scheduling` queue)
- Modify: `packages/contracts/src/errors.ts` — add `"NO_SHOW_REVIEW_FLAGGED"` (informational; used by admin flag path)
- Create test: `apps/api/test/appointments.e2e-spec.ts`

**Interfaces:**
- Consumes: `HoldsService`, `SchedulingService`, `EntitlementService.consume`, `PrismaService`, `CLOCK`.
- Produces: `AppointmentsService.book(u, dto: AppointmentCreate)`, `.reschedule(u, id, dto: Reschedule)`, `.cancel(u, id)`, `.flagNoShows(now: Date)`. `book` returns the created appointment DTO (owner ids stripped like vehicles).

- [ ] **Step 1: Failing e2e** — seed member + vehicle + ACTIVE subscription on a plan granting 1 `INSPECTION`; a service type with `entitlementType=INSPECTION`; a bay + shift. Assert:
  - book converts a held slot → 201, appointment `BOOKED`, entitlement decremented (GET entitlements shows `remaining:0`).
  - booking with the entitlement exhausted → `402` body `error.code==="ENTITLEMENT_EXHAUSTED"` with `overagePriceCentavos`.
  - two concurrent books on the same hold → exactly one 201, other 409 `SLOT_UNAVAILABLE`.
  - reschedule ≥24h out succeeds (needs a fresh hold); reschedule <24h out as member → 403 `FORBIDDEN_ROLE` (advisor-only), advisor succeeds.
  - cancel ≥24h out refunds entitlement (remaining back to 1).
  - `flagNoShows(now)` marks a past `BOOKED` as `NO_SHOW`.

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement `book`** — inside `prisma.$transaction`: re-validate the hold exists in Redis and belongs to `u.id`; look up the service type; if `entitlementType` set, resolve the vehicle's active subscription and call `entitlement.consume(subId, type, 1, appointmentId)` — on `{ok:false, reason:"EXHAUSTED"}` throw `DomainError("ENTITLEMENT_EXHAUSTED", …, 402)` carrying `overagePriceCentavos`; on `SUSPENDED` throw `SUBSCRIPTION_SUSPENDED` 403. Create the `Appointment` row (`scheduledStart/End` from hold ISO + duration). Release the hold key. Return mapped DTO. Guard the slot with a final DB overlap check inside the txn to close the hold-expiry race → `SLOT_UNAVAILABLE` 409.

- [ ] **Step 4: Implement `reschedule`/`cancel`** — reschedule: if `scheduledStart - now < 24h` and `u.role === "MEMBER"` → `FORBIDDEN_ROLE` 403; else convert the new hold, update times. cancel: set `CANCELLED`; if the appointment consumed an entitlement and `scheduledStart - now ≥ 24h`, refund by decrementing `entitlementUsage.usedQty` (guarded, floor 0). No refund inside 24h.

- [ ] **Step 5: Implement `flagNoShows` + job wiring** — `flagNoShows(now)`: `updateMany` appointments `status=BOOKED, scheduledEnd < now` → `NO_SHOW`. Then per vehicle with ≥3 `NO_SHOW` in trailing 6 months, write an admin review `AuditLog`/notification (reuse audit pattern). Register a `scheduling` BullMQ queue; `scheduling.scheduler.ts` `upsertJobScheduler("scheduling.flagNoShows", { pattern: "0 5 * * *", tz: MANILA_TZ }, { name: "flagNoShows" })`; `scheduling.processor.ts` (`@Processor("scheduling")`) dispatches to `flagNoShows(clock.now())`.

- [ ] **Step 6: Run, expect pass.**

- [ ] **Step 7: Commit** — `feat(scheduling): appointments book/reschedule/cancel + no-show job (FR-044..046)`.

---

## Task 5: Due-service reminders + odometer accuracy (FR-047, FR-048)

**Files:**
- Create: `apps/api/src/modules/scheduling/reminders.service.ts`
- Create test: `apps/api/src/modules/scheduling/reminders.service.spec.ts` (real DB)
- Modify: `scheduling.processor.ts`, `scheduling.scheduler.ts` (add `reminders.serviceDue` at `0 0 * * *`... actually `08:00` → `0 8 * * *`)
- Modify (member): odometer quick-entry already exists in `apps/member` vehicles feature; wire M-32 entry point on home (Task 7).

**Interfaces:**
- Consumes: `PrismaService`, `CLOCK`.
- Produces: `RemindersService.dueCandidates(now: Date): Promise<Array<{ vehicleId: string; serviceTypeId: string; reason: "TIME"|"ODOMETER" }>>`, `.serviceDue(now)`.

- [ ] **Step 1: Failing unit test** — table-driven: a vehicle last serviced 200 days ago with `intervalDays=180` → due (TIME); odometer delta ≥ `intervalKm` → due (ODOMETER); neither → not due. Plus a stagger test: over ~100 vehicles, `hash(vehicleId) % 28` spreads sends roughly uniformly (assert each day-bucket count within a tolerance band).

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement** — `dueCandidates`: for each active vehicle × service type with intervals, compute `dueByTime = daysSinceLastService ≥ intervalDays`, `dueByOdo = (currentOdometerKm − odoAtLastService) ≥ intervalKm`; candidate if either. `serviceDue(now)`: only send for vehicles whose `hash(vehicleId) % 28 === dayOfMonthIndex(now) % 28` (staggered load-shaping); write in-app `Notification` rows (channel dispatch is Phase 7 — in-app only now). Use a stable hash (e.g. FNV-1a over the uuid).

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Wire the job** — add `reminders.serviceDue` scheduler entry + processor branch.

- [ ] **Step 6: Commit** — `feat(scheduling): staggered due-service reminders (FR-047,048)`.

> **API kernel (Tasks 1–5) is the first execution milestone.** Stop here for review before UI. `pnpm turbo run typecheck lint test` must be green.

---

## Task 6: Advisor schedule board + config (W-02→W-04, A-06/A-07)

**Files:**
- Create: `apps/web/app/staff/schedule/page.tsx`, `apps/web/components/schedule/{Board,AppointmentCard,CreateDialog,BlockTool}.tsx`
- Create: `apps/web/app/staff/config/page.tsx` (bays, shifts, holidays, walk-in buffer editors)
- Create: `apps/web/lib/scheduling/api.ts` (typed fetchers hitting the API via the session cookie, following `apps/web/lib/auth/session.ts` auth)
- Create test: `apps/web/components/schedule/Board.test.tsx` (Vitest + RTL), `apps/web/e2e/schedule.spec.ts` (Playwright)
- Modify (API): add `POST /scheduling/bays`, `/shifts`, `/blocks`, `/operating-hours`, `/service-types` (advisor/admin-gated CRUD) + `POST /appointments` create-by-advisor path (member/vehicle lookup); emit a Socket.IO `appointment.changed` event (add a lightweight gateway; if Socket.IO isn't yet wired, fall back to 15s poll and leave a `TODO(realtime)` — decide at execution).

**Interfaces:**
- Consumes: `GET /scheduling/slots`, `POST /appointments`, `PATCH /appointments/:id/reschedule`, `POST /appointments/:id/cancel`, config CRUD.
- Produces: staff board UI; config screens the engine reads from.

- [ ] **Step 1: Failing RTL test** — `Board` renders appointment cards from a fixture day (member name, plate chip, service type, status pill) in a 15-min grid. Assert cards land in the right time rows.
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement `Board` + `AppointmentCard`** (CSS grid timeline, day/week/per-bay views). Follow `apps/web` Tailwind + design-token conventions (`packages/design-tokens`).
- [ ] **Step 4: RTL passes.**
- [ ] **Step 5: Implement `CreateDialog` (engine-backed slot pick), `BlockTool` (writes `CapacityBlock`), drag-to-move → reschedule (advisor override path), and `config` editors.**
- [ ] **Step 6: Playwright e2e** — advisor logs in, creates an appointment, drags it, cancels it; blocks a bay and confirms availability updates.
- [ ] **Step 7: Commit** — `feat(web): advisor schedule board + capacity config (W-02..04, A-06/07)`.

---

## Task 7: Member booking flow (M-19→M-23)

**Files:**
- Create: `apps/member/src/features/booking/{ServiceTypeScreen,SlotPickerScreen,PickupToggle,ConfirmScreen,BookingsListScreen}.tsx`, `bookingApi.ts`
- Modify: `apps/member/src/app/RootNavigator.tsx` (booking stack), home card entry point
- Create tests: colocated `*.test.tsx` (Jest + RTL, following `apps/member` `EmailAuthScreen.test.tsx` pattern; mock `bookingApi`)

**Interfaces:**
- Consumes: `GET /scheduling/slots`, `POST /scheduling/holds`, `DELETE /scheduling/holds/:id`, `POST /appointments`, `GET /appointments` (member's), `GET /subscriptions/:id/entitlements`.
- Produces: booking screens.

- [ ] **Step 1: Failing RTL** — service-type list shows an "included in your plan" badge when the entitlement has remaining > 0, price otherwise (drive from mocked entitlements).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3–5: Implement** M-19 service select → M-20 slot picker (month availability dots → day chips; hold acquired on select with a visible countdown; on expiry, prompt re-pick) → M-21 pickup toggle (feature-flagged off until Phase 6) → M-22 confirm (summary + "Uses 1 of N monthly inspections") → M-23 bookings list (upcoming/past; reschedule/cancel per rules with confirmations).
- [ ] **Step 6: Tests pass** incl. hold-expiry UX (timer lapse → re-pick prompt).
- [ ] **Step 7: Commit** — `feat(member): booking flow M-19..23 with entitlement-aware UX`.

---

## Task 8: Utilisation indicator (FR-052)

**Files:**
- Create: `apps/api/src/modules/scheduling/utilisation.service.ts` + admin route `GET /admin/capacity/utilisation?window=14d`
- Create test: `apps/api/src/modules/scheduling/utilisation.service.spec.ts` (real DB)
- Modify: `scheduling.scheduler.ts`/`processor.ts` (daily `capacity.utilisationAlarm`)
- Create (web): admin dashboard widget in `apps/web/app/admin/page.tsx`

**Interfaces:**
- Consumes: `PrismaService`, capacity engine (for "available" denominator), `CLOCK`.
- Produces: `UtilisationService.forWindow(days: number): Promise<Array<{ date: string; booked: number; available: number; ratio: number }>>`.

- [ ] **Step 1: Failing unit test** — ratio math over a seeded day (e.g. 6 booked of 8 capacity → 0.75); alarm fires when forward booking > threshold (config default 85%).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement service + admin endpoint (admin-gated).**
- [ ] **Step 4: Test passes.**
- [ ] **Step 5: Daily alarm job** — writes an admin notification when any forward day breaches threshold.
- [ ] **Step 6: Web widget** — bar row with threshold line, amber/red states.
- [ ] **Step 7: Commit** — `feat(scheduling): utilisation indicator + alarm (FR-052)`.

---

## Exit criteria

- **iOS:** member books, reschedules (≥24h free / <24h advisor-only), cancels; entitlement counted and refunded per the 24h rule; cannot book a slot lacking a bay or a skilled mechanic.
- **Web:** advisor sees the same truth on the board, moves an appointment, blocks a bay, and member-visible availability updates accordingly.
- **Engine:** `capacity-engine.spec.ts` green; a 30-day slot query resolves < 800 ms against seeded data (NFR-005).
- **Jobs:** `flagNoShows`, `reminders.serviceDue`, and the utilisation alarm run on their Manila-time schedules; no-show flagging and reminder stagger verified by tests.
- **Suite:** `pnpm turbo run typecheck lint test` green across `api`, `web`, `member`, and the shared packages.
- **Data safety:** every new real-DB test cleans up only its own fixtures (prefix-scoped) — verified by running the suite twice with no residual rows.
