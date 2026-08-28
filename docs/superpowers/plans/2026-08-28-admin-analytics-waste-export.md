# Admin Analytics & Waste Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Admin dashboard the three data sources it needs — MRR, active members and churn — plus a DENR-ready waste-record export, and record when a subscription actually ends.

**Architecture:** A `cancelledAt` migration closes a real gap (neither cancellation path records the end date today). A new `analytics` module keeps its arithmetic in a pure `metrics.ts` so the money maths is unit-testable without a database; the service does queries and composition. Waste export is a read plus a CSV serialiser, audit-logged because it is a compliance document.

**Tech Stack:** NestJS 10, Prisma, PostgreSQL (hosted Supabase), Jest, Zod contracts.

**Spec:** `docs/superpowers/specs/2026-08-28-staff-web-console-fidelity-design.md`

## Global Constraints

- **`CONTRACTED = ACTIVE | GRACE | PAST_DUE`.** A member late on payment has not churned. This set drives both MRR and active-members; do not narrow it to `ACTIVE`.
- **Interval normalisation:** `MONTHLY → price`, `QUARTERLY → price / 3`, `ANNUAL → price / 12`. Round to the nearest centavo.
- **Money is `bigint` centavos** through the query layer, converted once at the response boundary — matches the existing `priceCentavos` handling. Never use floating-point for money.
- **Admin gating** uses the established pattern: `if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);`. `FORBIDDEN_ROLE` is already in `packages/contracts/src/errors.ts`.
- **Never call `new Date()` in service logic** — inject `CLOCK` (`@Inject(CLOCK) private clock: Clock`) so tests can drive a deterministic timeline. `CLOCK` is `@Global`, no module import needed.
- **The test DB is hosted Supabase.** Real-DB tests MUST use prefix-scoped cleanup — **never truncate**. `testTimeout` is already 30s in `apps/api/jest.config.js`.
- **`apps/api`'s suite was reported hanging on 2026-08-28** (user-reported, unrelated to code). If it hangs, report that rather than working around it.

---

### Task 1: Record when a subscription actually ends

Neither cancellation path records the end date. Deferred cancellation sets `cancelRequestedAt` and leaves the status `ACTIVE`; `billing.service.ts` flips it to `CANCELLED` at period end — up to a full billing period later. Churn is not computable without this.

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (the `Subscription` model, ~line 266)
- Create: `apps/api/prisma/migrations/<timestamp>_add_subscription_cancelled_at/migration.sql`
- Modify: `apps/api/src/modules/billing/billing.service.ts:196`
- Modify: `apps/api/src/modules/subscriptions/subscriptions.service.ts:267`
- Test: `apps/api/src/modules/subscriptions/cancelled-at.spec.ts`

**Interfaces:**
- Produces: `Subscription.cancelledAt: Date | null` (column `cancelled_at`), set at both transition sites.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/subscriptions/cancelled-at.spec.ts`. This is a pure unit test over the transition helper shape — it asserts the two call sites pass `cancelledAt`, without needing a live DB:

```ts
/**
 * Guards the invariant that motivated the column: every path that moves a
 * subscription to CANCELLED must stamp cancelledAt. Without it, churn is
 * computed from cancelRequestedAt, which for deferred cancellations can be a
 * full billing period early.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, p), "utf8");

describe("cancelledAt is stamped at every CANCELLED transition", () => {
  it("the deferred finaliser in billing.service sets it", () => {
    const src = read("../billing/billing.service.ts");
    const update = src.slice(src.indexOf('status: "CANCELLED"') - 200, src.indexOf('status: "CANCELLED"') + 200);
    expect(update).toContain("cancelledAt");
  });

  it("the immediate cancel in subscriptions.service sets it", () => {
    const src = read("./subscriptions.service.ts");
    const idx = src.indexOf('status: "CANCELLED", cancelRequestedAt');
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 120)).toContain("cancelledAt");
  });

  it("the schema declares the column", () => {
    expect(read("../../../prisma/schema.prisma")).toMatch(/cancelledAt\s+DateTime\?\s+@map\("cancelled_at"\)/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- cancelled-at.spec.ts`
Expected: FAIL — all three assertions, the column does not exist yet.

- [ ] **Step 3: Add the column to the schema**

In `apps/api/prisma/schema.prisma`, inside `model Subscription`, add after the `cancelRequestedAt` line:

```prisma
  cancelledAt        DateTime?                 @map("cancelled_at")
```

- [ ] **Step 4: Write the migration**

Create `apps/api/prisma/migrations/20260828120000_add_subscription_cancelled_at/migration.sql`:

```sql
-- Records when a subscription actually reached CANCELLED. Previously only
-- cancel_requested_at existed, which for deferred cancellations is set up to a
-- full billing period before the subscription ends — so churn-over-a-window was
-- not computable.
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- Backfill. APPROXIMATE FOR HISTORICAL ROWS ONLY: for subscriptions cancelled
-- via the deferred path, cancel_requested_at precedes the true end date by up
-- to one billing period, so these values read early. Rows created after this
-- migration are stamped exactly at the transition. Do not treat pre-migration
-- history as precise.
UPDATE "subscriptions"
   SET "cancelled_at" = "cancel_requested_at"
 WHERE "status" = 'CANCELLED'
   AND "cancelled_at" IS NULL;
```

- [ ] **Step 5: Stamp it at the deferred finaliser**

In `apps/api/src/modules/billing/billing.service.ts` around line 196, change the update to also set `cancelledAt`. The surrounding loop finalises deferred cancellations at period end:

```ts
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED", cancelledAt: now },
      });
```

If the enclosing method has no `now` in scope, use the same clock value the method already uses for its period comparison rather than introducing `new Date()`.

- [ ] **Step 6: Stamp it at the immediate cancel**

In `apps/api/src/modules/subscriptions/subscriptions.service.ts` around line 267:

```ts
          data: { status: "CANCELLED", cancelRequestedAt: now, cancelledAt: now },
```

- [ ] **Step 7: Apply the migration and regenerate the client**

Run: `cd apps/api && pnpm prisma migrate deploy && pnpm prisma generate`
Expected: the migration applies and the client types include `cancelledAt`.

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- cancelled-at.spec.ts && pnpm typecheck`
Expected: PASS, 3 tests; typecheck clean.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma apps/api/src/modules/billing/billing.service.ts apps/api/src/modules/subscriptions
git commit -m "feat(api): record when a subscription actually ends

Neither cancellation path stamped an end date — deferred cancellation sets
cancelRequestedAt and leaves the status ACTIVE until the billing job flips
it at period end, up to a full period later. Churn over a window was
therefore not computable. Backfill of existing rows is approximate and
flagged as such in the migration."
```

---

### Task 2: The metric arithmetic, as pure functions

All the money and rate maths lives here so it is testable against golden fixtures without a database, matching how `capacity-engine.ts` is structured and tested.

**Files:**
- Create: `apps/api/src/modules/analytics/metrics.ts`
- Test: `apps/api/src/modules/analytics/metrics.spec.ts`

**Interfaces:**
- Produces:
  - `CONTRACTED_STATUSES: readonly ["ACTIVE", "GRACE", "PAST_DUE"]`
  - `normalisedMonthlyCentavos(priceCentavos: bigint, interval: "MONTHLY" | "QUARTERLY" | "ANNUAL"): bigint`
  - `mrrCentavos(subs: Array<{ priceCentavos: bigint; interval: BillingIntervalName }>): bigint`
  - `churnRate(cancelledInWindow: number, contractedAtWindowStart: number): number`
  - `type BillingIntervalName = "MONTHLY" | "QUARTERLY" | "ANNUAL"`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/analytics/metrics.spec.ts`:

```ts
import { normalisedMonthlyCentavos, mrrCentavos, churnRate, CONTRACTED_STATUSES } from "./metrics";

describe("normalisedMonthlyCentavos", () => {
  it("passes monthly through untouched", () => {
    expect(normalisedMonthlyCentavos(149900n, "MONTHLY")).toBe(149900n);
  });

  it("divides quarterly by three", () => {
    expect(normalisedMonthlyCentavos(450000n, "QUARTERLY")).toBe(150000n);
  });

  it("divides annual by twelve", () => {
    expect(normalisedMonthlyCentavos(1800000n, "ANNUAL")).toBe(150000n);
  });

  it("rounds to the nearest centavo rather than truncating", () => {
    // 100000 / 3 = 33333.33 → 33333; 200000 / 3 = 66666.67 → 66667
    expect(normalisedMonthlyCentavos(100000n, "QUARTERLY")).toBe(33333n);
    expect(normalisedMonthlyCentavos(200000n, "QUARTERLY")).toBe(66667n);
  });
});

describe("mrrCentavos", () => {
  it("sums a mixed book onto a monthly basis", () => {
    const total = mrrCentavos([
      { priceCentavos: 149900n, interval: "MONTHLY" },
      { priceCentavos: 450000n, interval: "QUARTERLY" },
      { priceCentavos: 1800000n, interval: "ANNUAL" },
    ]);
    expect(total).toBe(149900n + 150000n + 150000n);
  });

  it("is zero for an empty book", () => {
    expect(mrrCentavos([])).toBe(0n);
  });
});

describe("churnRate", () => {
  it("is cancellations over the opening population", () => {
    expect(churnRate(3, 150)).toBeCloseTo(0.02, 5);
  });

  it("is zero when nobody was contracted at the window start", () => {
    expect(churnRate(0, 0)).toBe(0);
  });

  it("does not divide by zero when cancellations exist but the opening count is zero", () => {
    expect(churnRate(2, 0)).toBe(0);
  });
});

describe("CONTRACTED_STATUSES", () => {
  it("counts members who are late but still under contract", () => {
    expect([...CONTRACTED_STATUSES].sort()).toEqual(["ACTIVE", "GRACE", "PAST_DUE"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- metrics.spec.ts`
Expected: FAIL — `Cannot find module './metrics'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/analytics/metrics.ts`:

```ts
/**
 * Admin dashboard arithmetic, kept pure so the money maths is testable without a
 * database. Everything is centavos as bigint — never floating point.
 */

export type BillingIntervalName = "MONTHLY" | "QUARTERLY" | "ANNUAL";

/**
 * Subscriptions that count as revenue-generating. A member five days late on a
 * card has not churned; excluding them would make MRR swing on payment timing
 * rather than on the business.
 */
export const CONTRACTED_STATUSES = ["ACTIVE", "GRACE", "PAST_DUE"] as const;

const MONTHS_PER_INTERVAL: Record<BillingIntervalName, bigint> = {
  MONTHLY: 1n,
  QUARTERLY: 3n,
  ANNUAL: 12n,
};

/** Divide, rounding half away from zero — bigint division truncates on its own. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

/** A plan's price expressed on a monthly basis, so intervals are comparable. */
export function normalisedMonthlyCentavos(priceCentavos: bigint, interval: BillingIntervalName): bigint {
  return divRound(priceCentavos, MONTHS_PER_INTERVAL[interval]);
}

export function mrrCentavos(subs: Array<{ priceCentavos: bigint; interval: BillingIntervalName }>): bigint {
  return subs.reduce((sum, s) => sum + normalisedMonthlyCentavos(s.priceCentavos, s.interval), 0n);
}

/**
 * Cancellations in the window over the population contracted when it opened.
 * A zero opening population yields 0 rather than NaN or Infinity — an empty book
 * has no churn to report.
 */
export function churnRate(cancelledInWindow: number, contractedAtWindowStart: number): number {
  if (contractedAtWindowStart <= 0) return 0;
  return cancelledInWindow / contractedAtWindowStart;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- metrics.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/analytics/metrics.ts apps/api/src/modules/analytics/metrics.spec.ts
git commit -m "feat(api): pure metric arithmetic for the admin dashboard

MRR normalises quarterly and annual plans onto a monthly basis and sums
over CONTRACTED = ACTIVE|GRACE|PAST_DUE. Churn returns 0 rather than NaN
on an empty book. Centavos stay bigint throughout."
```

---

### Task 3: Analytics service and endpoint

**Files:**
- Create: `apps/api/src/modules/analytics/analytics.service.ts`
- Create: `apps/api/src/modules/analytics/analytics.controller.ts`
- Create: `apps/api/src/modules/analytics/analytics.module.ts`
- Modify: `apps/api/src/app.module.ts` (import + register `AnalyticsModule`)
- Test: `apps/api/src/modules/analytics/analytics.service.spec.ts`

**Interfaces:**
- Consumes: `metrics.ts` (Task 2); `UtilisationService.forWindow(fromDate, days)` from `apps/api/src/modules/scheduling/utilisation.service.ts`; `CLOCK` / `Clock` from `apps/api/src/common/clock/clock.ts`.
- Produces: `GET /admin/analytics/summary` returning
  `{ mrrCentavos: string; activeMembers: number; churn30d: number; bayUtilisation: number }`.
  `mrrCentavos` is a **decimal string**, not a number — it is a bigint server-side and JSON has no bigint.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/analytics/analytics.service.spec.ts`. Prisma and utilisation are stubbed, so this runs without a database:

```ts
import { AnalyticsService } from "./analytics.service";
import { DomainError } from "../../common/errors/domain-error";

const NOW = new Date("2026-08-28T00:00:00.000Z");
const clock = { now: () => NOW };

const admin = { id: "u-admin", role: "ADMIN" } as never;
const advisor = { id: "u-adv", role: "ADVISOR" } as never;

function makePrisma(over: Partial<Record<string, unknown>> = {}) {
  return {
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { userId: "u1", plan: { priceCentavos: 149900n, billingInterval: "MONTHLY" } },
        { userId: "u1", plan: { priceCentavos: 149900n, billingInterval: "MONTHLY" } },
        { userId: "u2", plan: { priceCentavos: 450000n, billingInterval: "QUARTERLY" } },
      ]),
      count: jest.fn().mockResolvedValue(0),
    },
    ...over,
  } as never;
}

const utilisation = { forWindow: jest.fn().mockResolvedValue([{ ratio: 0.6 }, { ratio: 0.9 }]) } as never;

describe("AnalyticsService.summary", () => {
  it("refuses non-admins", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    await expect(svc.summary(advisor)).rejects.toThrow(DomainError);
  });

  it("sums MRR on a monthly basis and counts distinct members", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    const out = await svc.summary(admin);
    // 149900 + 149900 + (450000/3 = 150000)
    expect(out.mrrCentavos).toBe("449800");
    // u1 holds two subscriptions but is one member
    expect(out.activeMembers).toBe(2);
  });

  it("reports churn over the population contracted when the window opened", async () => {
    const prisma = makePrisma();
    // first count() = cancelled in window, second = contracted at window start
    (prisma as never as { subscription: { count: jest.Mock } }).subscription.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(150);
    const svc = new AnalyticsService(prisma, utilisation, clock);
    const out = await svc.summary(admin);
    expect(out.churn30d).toBeCloseTo(0.02, 5);
  });

  it("reports mean forward bay utilisation", async () => {
    const svc = new AnalyticsService(makePrisma(), utilisation, clock);
    const out = await svc.summary(admin);
    expect(out.bayUtilisation).toBeCloseTo(0.75, 5);
  });

  it("does not blow up on an empty book", async () => {
    const prisma = makePrisma();
    (prisma as never as { subscription: { findMany: jest.Mock } }).subscription.findMany.mockResolvedValue([]);
    const empty = { forWindow: jest.fn().mockResolvedValue([]) } as never;
    const svc = new AnalyticsService(prisma, empty, clock);
    const out = await svc.summary(admin);
    expect(out).toEqual({ mrrCentavos: "0", activeMembers: 0, churn30d: 0, bayUtilisation: 0 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- analytics.service.spec.ts`
Expected: FAIL — `Cannot find module './analytics.service'`.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/modules/analytics/analytics.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CLOCK, type Clock } from "../../common/clock/clock";
import { UtilisationService } from "../scheduling/utilisation.service";
import { CONTRACTED_STATUSES, churnRate, mrrCentavos, type BillingIntervalName } from "./metrics";

const CHURN_WINDOW_DAYS = 30;
const UTILISATION_WINDOW_DAYS = 14;

export type AnalyticsSummary = {
  /** Decimal string — centavos are bigint server-side and JSON has no bigint. */
  mrrCentavos: string;
  activeMembers: number;
  churn30d: number;
  bayUtilisation: number;
};

/** FR-052-adjacent admin reporting. Every figure is defined in the 2026-08-28 spec. */
@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private utilisation: UtilisationService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  async summary(u: AbilityUser): Promise<AnalyticsSummary> {
    this.assertAdmin(u);

    const now = this.clock.now();
    const windowStart = new Date(now.getTime() - CHURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const contracted = [...CONTRACTED_STATUSES];

    const subs = await this.prisma.subscription.findMany({
      where: { status: { in: contracted } },
      select: { userId: true, plan: { select: { priceCentavos: true, billingInterval: true } } },
    });

    const mrr = mrrCentavos(
      subs.map((s) => ({
        priceCentavos: s.plan.priceCentavos,
        interval: s.plan.billingInterval as BillingIntervalName,
      })),
    );
    const activeMembers = new Set(subs.map((s) => s.userId)).size;

    // Order matters: the spec's churn denominator is the population contracted
    // when the window opened — everyone contracted now, plus everyone who left
    // during it.
    const cancelledInWindow = await this.prisma.subscription.count({
      where: { status: "CANCELLED", cancelledAt: { gte: windowStart, lte: now } },
    });
    const contractedNow = await this.prisma.subscription.count({
      where: { status: { in: contracted } },
    });

    const days = await this.utilisation.forWindow(
      now.toISOString().slice(0, 10),
      UTILISATION_WINDOW_DAYS,
    );
    const bayUtilisation = days.length === 0
      ? 0
      : days.reduce((sum, d) => sum + d.ratio, 0) / days.length;

    return {
      mrrCentavos: mrr.toString(),
      activeMembers,
      churn30d: churnRate(cancelledInWindow, contractedNow + cancelledInWindow),
      bayUtilisation,
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- analytics.service.spec.ts`
Expected: PASS, 5 tests. The churn case asserts `3 / (147 + 3)` — if the stub's second `count` returns 150 as the *current* contracted figure, adjust the fixture so the denominator maths matches the implementation; the invariant under test is "denominator is the opening population", not the literal stub numbers.

- [ ] **Step 5: Add the controller and module**

Create `apps/api/src/modules/analytics/analytics.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { AnalyticsService } from "./analytics.service";

@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get("summary")
  summary(@CurrentUser() u: AbilityUser) {
    return this.analytics.summary(u);
  }
}
```

Create `apps/api/src/modules/analytics/analytics.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { SchedulingModule } from "../scheduling/scheduling.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [SchedulingModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
```

If `SchedulingModule` does not export `UtilisationService`, add it to that module's `exports` array — the analytics service depends on it rather than recomputing utilisation.

- [ ] **Step 6: Register the module**

In `apps/api/src/app.module.ts`, add the import alongside the others:

```ts
import { AnalyticsModule } from "./modules/analytics/analytics.module";
```

and add `AnalyticsModule,` to the `imports` array after `AttentionModule,`.

- [ ] **Step 7: Verify**

Run: `cd apps/api && pnpm test -- analytics && pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/analytics apps/api/src/app.module.ts apps/api/src/modules/scheduling/scheduling.module.ts
git commit -m "feat(api): admin analytics summary endpoint

GET /admin/analytics/summary returns MRR, distinct active members, 30-day
churn and mean forward bay utilisation. Utilisation delegates to the
existing UtilisationService rather than recomputing it. mrrCentavos is a
decimal string because JSON has no bigint."
```

---

### Task 4: Waste summary and DENR CSV export

**Files:**
- Create: `apps/api/src/modules/analytics/waste-csv.ts`
- Create: `apps/api/src/modules/analytics/waste-export.service.ts`
- Modify: `apps/api/src/modules/analytics/analytics.controller.ts`
- Modify: `apps/api/src/modules/analytics/analytics.module.ts`
- Test: `apps/api/src/modules/analytics/waste-csv.spec.ts`
- Test: `apps/api/src/modules/analytics/waste-export.service.spec.ts`

**Interfaces:**
- Consumes: Prisma `WasteRecord` (fields `wasteType`, `quantity`, `unit`, `haulerName`, `manifestNo`, `disposedAt`, `createdAt`, `workOrder`).
- Produces:
  - `toCsv(rows: WasteExportRow[]): string`
  - `type WasteExportRow = { disposedAt: string; workOrderNumber: string; plateNo: string; wasteType: string; quantity: number; unit: string; haulerName: string | null; manifestNo: string | null }`
  - `GET /admin/waste/summary?from=&to=` → `{ totals: Array<{ wasteType: string; quantity: number; unit: string }>; recordCount: number; lastExportedAt: string | null }`
  - `GET /admin/waste/export?from=&to=` → `text/csv`

- [ ] **Step 1: Write the failing CSV test**

Create `apps/api/src/modules/analytics/waste-csv.spec.ts`:

```ts
import { toCsv, type WasteExportRow } from "./waste-csv";

const row: WasteExportRow = {
  disposedAt: "2026-08-20",
  workOrderNumber: "WO-202608-0001",
  plateNo: "ABC 1234",
  wasteType: "USED_OIL",
  quantity: 4.2,
  unit: "L",
  haulerName: "Zamboanga Enviro",
  manifestNo: "MF-99",
};

describe("toCsv", () => {
  it("emits the DENR header row first", () => {
    expect(toCsv([]).split("\n")[0]).toBe(
      "disposed_at,work_order,plate,waste_type,quantity,unit,hauler,manifest_no",
    );
  });

  it("writes a record in column order", () => {
    expect(toCsv([row]).split("\n")[1]).toBe(
      "2026-08-20,WO-202608-0001,ABC 1234,USED_OIL,4.2,L,Zamboanga Enviro,MF-99",
    );
  });

  it("leaves optional hauler and manifest empty rather than printing null", () => {
    const bare = { ...row, haulerName: null, manifestNo: null };
    expect(toCsv([bare]).split("\n")[1]).toBe(
      "2026-08-20,WO-202608-0001,ABC 1234,USED_OIL,4.2,L,,",
    );
  });

  it("quotes and escapes a value containing a comma or quote", () => {
    const messy = { ...row, haulerName: 'Cruz, Sons & Co "Enviro"' };
    expect(toCsv([messy]).split("\n")[1]).toContain('"Cruz, Sons & Co ""Enviro"""');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- waste-csv.spec.ts`
Expected: FAIL — `Cannot find module './waste-csv'`.

- [ ] **Step 3: Implement the serialiser**

Create `apps/api/src/modules/analytics/waste-csv.ts`:

```ts
/**
 * DENR hazardous-waste export. This is a regulator-facing document, so the
 * column set and order are fixed — add columns at the end, never reorder.
 */

export type WasteExportRow = {
  disposedAt: string;
  workOrderNumber: string;
  plateNo: string;
  wasteType: string;
  quantity: number;
  unit: string;
  haulerName: string | null;
  manifestNo: string | null;
};

const HEADER = "disposed_at,work_order,plate,waste_type,quantity,unit,hauler,manifest_no";

/** RFC 4180: wrap in quotes and double any embedded quote, when needed. */
function cell(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: WasteExportRow[]): string {
  const lines = rows.map((r) =>
    [r.disposedAt, r.workOrderNumber, r.plateNo, r.wasteType, r.quantity, r.unit, r.haulerName, r.manifestNo]
      .map(cell)
      .join(","),
  );
  return [HEADER, ...lines].join("\n");
}
```

- [ ] **Step 4: Run the CSV test to verify it passes**

Run: `cd apps/api && pnpm test -- waste-csv.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing service test**

Create `apps/api/src/modules/analytics/waste-export.service.spec.ts`:

```ts
import { WasteExportService } from "./waste-export.service";
import { DomainError } from "../../common/errors/domain-error";

const NOW = new Date("2026-08-28T00:00:00.000Z");
const clock = { now: () => NOW };
const admin = { id: "u-admin", role: "ADMIN" } as never;
const advisor = { id: "u-adv", role: "ADVISOR" } as never;

const record = {
  wasteType: "USED_OIL",
  quantity: 4.2,
  unit: "L",
  haulerName: "Zamboanga Enviro",
  manifestNo: "MF-99",
  disposedAt: new Date("2026-08-20T00:00:00.000Z"),
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  workOrder: { number: "WO-202608-0001", vehicle: { plateNo: "ABC 1234" } },
};

function makePrisma() {
  return {
    wasteRecord: { findMany: jest.fn().mockResolvedValue([record]) },
    auditLog: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
  } as never;
}

describe("WasteExportService", () => {
  it("refuses non-admins on export", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    await expect(svc.exportCsv(advisor, "2026-07-01", "2026-09-30")).rejects.toThrow(DomainError);
  });

  it("returns CSV for the window", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    const csv = await svc.exportCsv(admin, "2026-07-01", "2026-09-30");
    expect(csv.split("\n")[0]).toContain("disposed_at");
    expect(csv).toContain("WO-202608-0001");
    expect(csv).toContain("ABC 1234");
  });

  it("audit-logs every export — this is a compliance document", async () => {
    const prisma = makePrisma();
    const svc = new WasteExportService(prisma, clock);
    await svc.exportCsv(admin, "2026-07-01", "2026-09-30");
    const create = (prisma as never as { auditLog: { create: jest.Mock } }).auditLog.create;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "WASTE_EXPORTED", actorUserId: "u-admin" }),
      }),
    );
  });

  it("summarises totals per waste type", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    const out = await svc.summary(admin, "2026-07-01", "2026-09-30");
    expect(out.recordCount).toBe(1);
    expect(out.totals).toEqual([{ wasteType: "USED_OIL", quantity: 4.2, unit: "L" }]);
  });

  it("reports the last export date from the audit trail", async () => {
    const prisma = makePrisma();
    (prisma as never as { auditLog: { findFirst: jest.Mock } }).auditLog.findFirst
      .mockResolvedValue({ createdAt: new Date("2026-06-30T00:00:00.000Z") });
    const svc = new WasteExportService(prisma, clock);
    const out = await svc.summary(admin, "2026-07-01", "2026-09-30");
    expect(out.lastExportedAt).toBe("2026-06-30T00:00:00.000Z");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- waste-export.service.spec.ts`
Expected: FAIL — `Cannot find module './waste-export.service'`.

- [ ] **Step 7: Implement the service**

Create `apps/api/src/modules/analytics/waste-export.service.ts`:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CLOCK, type Clock } from "../../common/clock/clock";
import { toCsv, type WasteExportRow } from "./waste-csv";

export type WasteSummary = {
  totals: Array<{ wasteType: string; quantity: number; unit: string }>;
  recordCount: number;
  lastExportedAt: string | null;
};

const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999Z`);

/** W-09 hazardous-waste reporting (DENR). Exports are audit-logged. */
@Injectable()
export class WasteExportService {
  constructor(private prisma: PrismaService, @Inject(CLOCK) private clock: Clock) {}

  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  /** Records are dated by disposal where known, falling back to capture time. */
  private async rows(from: string, to: string) {
    return this.prisma.wasteRecord.findMany({
      where: { createdAt: { gte: dayStart(from), lte: dayEnd(to) } },
      orderBy: { createdAt: "asc" },
      select: {
        wasteType: true, quantity: true, unit: true, haulerName: true, manifestNo: true,
        disposedAt: true, createdAt: true,
        workOrder: { select: { number: true, vehicle: { select: { plateNo: true } } } },
      },
    });
  }

  async summary(u: AbilityUser, from: string, to: string): Promise<WasteSummary> {
    this.assertAdmin(u);
    const rows = await this.rows(from, to);

    const byType = new Map<string, { wasteType: string; quantity: number; unit: string }>();
    for (const r of rows) {
      const existing = byType.get(r.wasteType);
      if (existing) existing.quantity += r.quantity;
      else byType.set(r.wasteType, { wasteType: r.wasteType, quantity: r.quantity, unit: r.unit });
    }

    const lastExport = await this.prisma.auditLog.findFirst({
      where: { action: "WASTE_EXPORTED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return {
      totals: [...byType.values()],
      recordCount: rows.length,
      lastExportedAt: lastExport?.createdAt.toISOString() ?? null,
    };
  }

  async exportCsv(u: AbilityUser, from: string, to: string): Promise<string> {
    this.assertAdmin(u);
    const rows = await this.rows(from, to);

    const mapped: WasteExportRow[] = rows.map((r) => ({
      disposedAt: (r.disposedAt ?? r.createdAt).toISOString().slice(0, 10),
      workOrderNumber: r.workOrder.number,
      plateNo: r.workOrder.vehicle.plateNo,
      wasteType: r.wasteType,
      quantity: r.quantity,
      unit: r.unit,
      haulerName: r.haulerName,
      manifestNo: r.manifestNo,
    }));

    // A regulator-facing document leaving the system is an auditable event.
    await this.prisma.auditLog.create({
      data: {
        actorUserId: u.id,
        action: "WASTE_EXPORTED",
        entityType: "WasteRecord",
        entityId: `${from}..${to}`,
        after: { from, to, recordCount: mapped.length, at: this.clock.now().toISOString() },
      },
    });

    return toCsv(mapped);
  }
}
```

If `WorkOrder` has no `vehicle` relation with `plateNo`, use whatever relation it does expose to reach the plate and adjust the `select` — the CSV column stays `plate`.

- [ ] **Step 8: Add the routes**

In `apps/api/src/modules/analytics/analytics.controller.ts`, add the imports and routes. The CSV route sets its own headers, so it takes the raw response:

```ts
import { Controller, Get, Header, Query } from "@nestjs/common";
import { WasteExportService } from "./waste-export.service";
```

Add to the constructor: `private waste: WasteExportService`. Then:

```ts
  @Get("/../waste/summary")
  wasteSummary(@CurrentUser() u: AbilityUser, @Query("from") from: string, @Query("to") to: string) {
    return this.waste.summary(u, from, to);
  }
```

Nest does not resolve `..` in route paths — instead give the waste routes their own controller. Create
`apps/api/src/modules/analytics/waste.controller.ts`:

```ts
import { Controller, Get, Header, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { WasteExportService } from "./waste-export.service";

@Controller("admin/waste")
export class WasteController {
  constructor(private waste: WasteExportService) {}

  @Get("summary")
  summary(@CurrentUser() u: AbilityUser, @Query("from") from: string, @Query("to") to: string) {
    return this.waste.summary(u, from, to);
  }

  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="autocare-waste-export.csv"')
  export(@CurrentUser() u: AbilityUser, @Query("from") from: string, @Query("to") to: string) {
    return this.waste.exportCsv(u, from, to);
  }
}
```

The global `EnvelopeInterceptor` wraps responses in `{ success, data }`. CSV must not be wrapped — check `apps/api/src/common/interceptors/envelope.interceptor.ts` for an existing bypass (a decorator or a content-type check). If there is none, add one keyed on the response's `Content-Type` already being `text/csv`, and note it in the commit.

Register both in `analytics.module.ts`: add `WasteController` to `controllers` and `WasteExportService` to `providers` and `exports`.

- [ ] **Step 9: Verify**

Run: `cd apps/api && pnpm test -- waste && pnpm typecheck`
Expected: PASS, 9 tests across the two files; typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/analytics
git commit -m "feat(api): DENR waste summary and CSV export

Waste records were write-only. Adds an admin-gated summary for the
dashboard card and an RFC 4180 CSV export. Every export writes an
AuditLog row — it is a regulator-facing document, so it needs a
compliance trail, and it gives the card its 'last exported' date."
```

---

### Task 5: Operating-hours read

The Board's walk-in-buffer row has no source: `SchedulingConfigController` has a `PUT` for operating hours and no `GET`.

**Files:**
- Modify: `apps/api/src/modules/scheduling/scheduling-config.controller.ts:48`
- Modify: `apps/api/src/modules/scheduling/scheduling-config.service.ts`
- Test: `apps/api/src/modules/scheduling/operating-hours-read.spec.ts`

**Interfaces:**
- Produces: `GET /scheduling/operating-hours` → `Array<{ weekday: string | null; dateOverride: string | null; openTime: string | null; closeTime: string | null; walkInBufferPct: number }>`, staff-gated like its sibling.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/scheduling/operating-hours-read.spec.ts`:

```ts
import { SchedulingConfigService } from "./scheduling-config.service";
import { DomainError } from "../../common/errors/domain-error";

const staff = { id: "u1", role: "ADVISOR" } as never;
const member = { id: "u2", role: "MEMBER" } as never;

const rows = [{ weekday: "MON", dateOverride: null, openTime: "08:00", closeTime: "17:00", walkInBufferPct: 20 }];
const prisma = { operatingHours: { findMany: jest.fn().mockResolvedValue(rows) } } as never;

describe("SchedulingConfigService.listOperatingHours", () => {
  it("returns the configured hours to staff", async () => {
    const svc = new SchedulingConfigService(prisma);
    await expect(svc.listOperatingHours(staff)).resolves.toEqual(rows);
  });

  it("refuses non-staff", async () => {
    const svc = new SchedulingConfigService(prisma);
    await expect(svc.listOperatingHours(member)).rejects.toThrow(DomainError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm test -- operating-hours-read.spec.ts`
Expected: FAIL — `listOperatingHours is not a function`.

- [ ] **Step 3: Implement the service method**

In `apps/api/src/modules/scheduling/scheduling-config.service.ts`, beside the existing `upsertOperatingHours`:

```ts
  /** Read side of the operating-hours config — the Board's walk-in buffer row. */
  async listOperatingHours(u: AbilityUser) {
    this.assertStaff(u);
    return this.prisma.operatingHours.findMany({ orderBy: { weekday: "asc" } });
  }
```

- [ ] **Step 4: Add the route**

In `apps/api/src/modules/scheduling/scheduling-config.controller.ts`, above the existing `@Put("operating-hours")`:

```ts
  @Get("operating-hours")
  listOperatingHours(@CurrentUser() u: AbilityUser) {
    return this.config.listOperatingHours(u);
  }
```

- [ ] **Step 5: Verify**

Run: `cd apps/api && pnpm test -- operating-hours-read.spec.ts && pnpm typecheck`
Expected: PASS, 2 tests; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scheduling
git commit -m "feat(api): read operating hours

Symmetric with the existing PUT. Feeds the schedule board's walk-in
buffer row, which had no data source."
```

---

### Task 6: Verify the backend

- [ ] **Step 1: Run the API suite**

Run: `cd apps/api && pnpm test 2>&1 | tail -30`
Expected: all suites pass.

If the suite hangs (reported 2026-08-28 and unrelated to this work), do **not** work around it. Run the new specs in isolation — `pnpm test -- analytics waste metrics cancelled-at operating-hours-read` — record that result, and report the hang.

- [ ] **Step 2: Typecheck the workspace**

Run: `cd apps/api && pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Confirm the routes are registered**

Run: `cd apps/api && grep -rn "admin/analytics\|admin/waste\|Get(\"operating-hours\")" src/modules --include='*.controller.ts'`
Expected: three matches — the analytics summary, the two waste routes, and the operating-hours read.

- [ ] **Step 4: Commit any fixes**

If steps 1–3 required changes, commit them with a message naming what broke and why.

---

## Self-Review

**Spec coverage:** §1.1 → Task 1; §1.2 → Tasks 2–3 (pure maths, then service/endpoint); §1.3 → Task 4; §1.4 → Task 5; the testing section's API bullet → the test step opening every task plus Task 6.

**Type consistency:** `BillingIntervalName` is defined in Task 2 and consumed in Task 3's `plan.billingInterval as BillingIntervalName`. `CONTRACTED_STATUSES` is defined once in Task 2 and spread into Prisma `in` filters in Task 3. `WasteExportRow` is defined in Task 4's `waste-csv.ts` and consumed by `waste-export.service.ts` in the same task. `mrrCentavos` returns `bigint` and is stringified exactly once, at the service boundary.

**Known risks carried deliberately:** Task 3 Step 4 flags that the churn stub's numbers must match the implementation's denominator (`contractedNow + cancelledInWindow`); Task 4 Step 8 flags that the envelope interceptor may wrap the CSV and must be checked; Task 4 Step 7 flags the `workOrder.vehicle.plateNo` relation as an assumption to verify.
