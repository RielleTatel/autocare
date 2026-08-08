# Phase 3 — Scheduling & Capacity Implementation Plan (DRAFT)

> **Status: DRAFT** — expand into bite-sized TDD steps at phase start. The capacity engine signature and hold protocol below are settled.
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Members book real, capacity-checked appointment slots and consume entitlements; advisors run the day from a schedule board; the system never sells a slot it can't service.

**Covers:** M4 (FR-041→FR-052). Screens M-19→M-23, M-32; W-02→W-04; A-06, A-07 (config screens it depends on); part of A-01 (utilisation widget). BR-04.

**Prerequisites:** Phases 0–2 (entitlement service, member app shell, advisor web auth).

## Global Constraints (additional)

- A slot requires **both** a free bay with the right capability and a mechanic on shift with the required skill (two-resource constraint, Architecture §7.7).
- Holds: 10 min TTL in Redis (FR-043); booking converts a hold atomically; expired hold → `SLOT_UNAVAILABLE` 409.
- Walk-in buffer: a configurable % of daily capacity withheld from online booking — never visible to members.
- Slot availability query ≤ 800 ms for a 30-day window (NFR-005): precompute per-day summaries, don't scan appointments per request.
- Reschedule free up to 24 h before start (FR-044); later reschedule goes through the advisor.

## Tasks

### Task 1: Schema — capacity tables
`ServiceBay { name, capabilities[], isActive }`, `StaffShift { userId, date, startTime, endTime, skills[] }`, `ServiceType { code, name, standardDurationMin, requiredSkills[], priceCentavos }`, `Appointment { vehicleId, serviceTypeId, bayId?, scheduledStart/End, status BOOKED|CONFIRMED|IN_PROGRESS|COMPLETED|CANCELLED|NO_SHOW, requiresPickup, createdBy }`, `CapacityBlock { bayId?, date, start, end, reason }`, plus `OperatingHours` config (per weekday + holiday overrides). Index `(scheduledStart, bayId)`.

### Task 2: Capacity engine (pure, the phase's kernel)
**Files:** `apps/api/src/modules/scheduling/capacity-engine.ts` — pure function, exhaustive unit tests before any endpoint:
```typescript
export interface CapacityInputs {
  date: string;                      // YYYY-MM-DD, Asia/Manila
  serviceType: { durationMin: number; requiredSkills: string[] };
  operatingWindow: { open: string; close: string } | null;  // null = closed/holiday
  bays: Array<{ id: string; capabilities: string[] }>;
  blocks: Array<{ bayId: string | null; start: string; end: string }>;
  shifts: Array<{ mechanicId: string; start: string; end: string; skills: string[] }>;
  appointments: Array<{ bayId: string; start: string; end: string }>;
  holds: Array<{ bayId: string; start: string; end: string }>;
  walkInBufferPct: number;           // 0–100, share of slots withheld
}
export interface Slot { start: string; end: string; bayId: string }
export function availableSlots(i: CapacityInputs): Slot[];
```
Algorithm: slice the operating window into `durationMin` steps → for each (slot, bay): bay has capability, not blocked, no appointment/hold overlap → require ≥1 mechanic whose shift covers the slot with required skill and who isn't already committed (mechanic count ≥ concurrent slot count at that time) → drop the last `walkInBufferPct` of each day's surviving slots.
**Golden tests:** closed day → []; bay blocked → other bay only; skilled mechanic absent → slot closed even with free bay; buffer withholds exactly N; overlapping appointment excludes; DST-free Manila arithmetic.

### Task 3: Slot query + hold protocol (FR-041→FR-043)
`GET /scheduling/slots?from&to&serviceTypeId` — loads inputs, runs engine, subtracts Redis holds; per-day result cached 60 s, invalidated on booking/cancel/block-change. `POST /scheduling/holds { slot }` → Redis `SET hold:{bayId}:{start} userId NX EX 600`; conflict → `SLOT_UNAVAILABLE`. `DELETE /scheduling/holds/:id`. **Tests:** two users race one slot → one hold; expiry frees it; perf test 30-day window under 800 ms with 2 bays × 90 days seeded.

### Task 4: Appointments (FR-044→FR-046)
`POST /appointments` (converts caller's hold in a transaction; consumes `INSPECTION`/service entitlement via Phase 2's `EntitlementService.consume` — exhausted → 402 with overage price, member confirms billable extra); `PATCH /:id/reschedule` (free ≥24 h out, else advisor-only); `POST /:id/cancel`; nightly `appointments.flagNoShows` job marks past `BOOKED` as `NO_SHOW`; 3 no-shows/6 months → admin review flag (FR-046). **Tests:** hold conversion race; entitlement decrement on book, refund on ≥24 h cancel; no-show flagging.

### Task 5: Due-service reminders + odometer (FR-047, FR-048)
`reminders.serviceDue` job (08:00): candidates by max(time since last service vs interval, odometer delta vs interval) using manufacturer defaults per `ServiceType`; **staggered** — hash(vehicleId) spreads sends across the month (Architecture §7.7 load shaping). Writes `Notification` rows (channel dispatch arrives Phase 7; until then in-app only). Member M-32 quick odometer entry feeds accuracy. **Tests:** interval math table; stagger distribution roughly uniform.

### Task 6: Advisor schedule board (W-02→W-04)
Next.js `/staff/schedule`: day / week / per-bay views (CSS grid timeline, 15-min rows); appointment cards (member, vehicle plate chip, service type, status pill); drag-to-move calls reschedule endpoint (advisor override path); create-appointment dialog (member/vehicle lookup → engine-backed slot pick); block tool for bays/dates (maintenance, holiday) writing `CapacityBlock`; walk-in buffer setting on A-07 config page (bays, shifts, holidays editor). Realtime refresh via Socket.IO `appointment.changed` (add event to gateway). **Tests:** RTL for board rendering from fixture day; Playwright: create → drag → cancel.

### Task 7: Member booking flow (M-19→M-23)
M-19 service type selection (entitlement badge "included in your plan" vs price); M-20 slot picker (calendar month with availability dots → day's slot chips; hold acquired on selection, countdown shown); M-21 pick-up toggle (stub — zone check arrives Phase 6; hidden behind feature flag until then); M-22 confirmation (summary + entitlement usage line "Uses 1 of 2 monthly inspections"); M-23 bookings list (upcoming/past, reschedule/cancel per rules with confirmations). **Tests:** hold-expiry UX (timer lapse → re-pick prompt); RTL flows.

### Task 8: Utilisation indicator (FR-052)
`GET /admin/capacity/utilisation?window=14d` → per-day booked/available ratio; alarm when forward booking > threshold (config, default 85%). Admin dashboard widget (bar row, threshold line, amber/red states). `quota`-style daily job writes an alert notification to admins when breached. **Tests:** ratio math; alarm trigger.

## Exit criteria
- iOS: member books, reschedules, cancels; entitlement counted; can't book a slot that lacks bay or mechanic.
- Web: advisor sees the same truth on the board instantly, moves an appointment, blocks a bay and member availability updates.
- Capacity engine golden tests green; 30-day slot query under 800 ms against seeded data.
- Utilisation alarm fires in a seeded over-booked scenario.
