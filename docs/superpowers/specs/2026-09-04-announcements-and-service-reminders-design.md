# Announcements & Service Reminders — Design

**Date:** 2026-09-04
**Requirements:** FR-047, FR-048, FR-107, FR-090 (in-app half) · **Screens:** M-33 (adapted), A-16
**Status:** Approved design, ready for implementation planning

## 1. Purpose

Give members a persistent, per-member feed of everything the app has told them about their
vehicles — service due, appointment lifecycle, and admin broadcasts — and make that feed the
single source of service-due truth for the "What Needs Attention" home screen.

Two client-doc promises are currently unmet, and one of them is a live defect. This work
closes both.

## 2. Background

### 2.1 What the client docs promise

`AUTOCARE MEMBERSHIP APP FEATURES.pdf` lists **ANNOUNCEMENTS** among the app's basic
features, and describes maintenance reminders as:

> "the app automatically creates a maintenance schedule and sends reminders when it's time
> for the next service. Every completed maintenance is recorded, and the schedule is updated
> automatically."

Its Appointment Scheduling section separately promises "The app sends a reminder before the
appointment."

### 2.2 What actually exists

The reminder *engine* is sound. `reminders.service.ts` correctly implements FR-047 —
due-by-time and due-by-odometer against manufacturer intervals, with an FNV-1a 28-day stagger
for load shaping. `vehicles.service.ts` implements FR-048 odometer capture.

Three things are wrong.

**Defect 1 — reminders never fire.** `dueCandidates()` only selects service types carrying an
interval:

```ts
where: { isActive: true, OR: [{ intervalDays: { not: null } }, { intervalKm: { not: null } }] }
```

`prisma/seed-scheduling.ts` seeds all five service types **without `intervalDays` or
`intervalKm`**. The query returns nothing, the function short-circuits on
`serviceTypes.length === 0`, and the daily 08:00 job creates zero reminders — permanently, on
any seeded environment. Unit tests pass because they construct their own fixtures. Intervals
are settable only through admin config CRUD, so unless an operator manually configured every
service type, the entire feature is dark.

**Defect 2 — the last-service date is never captured.** The client doc says members enter
"the car model, current mileage, and the date of the last service" at registration.
`vehicleCreateSchema` has `make`, `model`, `year`, `odometerKm` — but no last-service field,
and `AddVehicleScreen.tsx` collects none. `dueCandidates()` therefore falls back to the
vehicle's `createdAt` as the baseline, meaning a car serviced last week and a car serviced two
years ago are treated identically at registration.

**Gap 3 — nothing is ever sent, and there is no announcements feature at all.** A due service
writes a `ServiceReminder` row that surfaces only inside the computed attention feed. There is
no push, no SMS, no notification centre, no announcements screen, and no `Announcement`
model. `schema.prisma:507` acknowledges this: *"notification centre + channel dispatch
(SMS/push) arrives in Phase 7."*

### 2.3 A docs conflict worth recording

The client PDF treats Announcements as a member-facing feature. The SRS does not: FR-107 is an
*admin broadcast* capability (priority 🟡, Wave 3), screen inventory lists only **A-16
Announcements** under admin screens, and member-facing delivery is routed through **M-33
Notifications centre** (FR-092/093) which is unbuilt.

**Resolution:** build a member-facing Announcements screen now, carrying both system-generated
threads and admin broadcasts. This satisfies the client PDF without requiring the full Phase 7
notification centre (retention policy, per-category preferences, channel dispatch). M-33
remains a future superset; this screen is a subset of it that can later absorb other
notification categories.

## 3. Core concept — announcements are threads, not log lines

The client doc's "the schedule is updated automatically" is the design constraint. An
announcement is a **stateful thread updated in place**, not an append-only stream:

```
"Oil change due"  →  member books  →  "Oil change scheduled for Sep 12"
                  →  service done  →  "Oil change completed"  →  thread closes
```

One row transitioning through states — not three unrelated notifications accumulating. The
next due cycle opens a fresh thread.

This is what makes the feed readable rather than a nag log, and it is the behaviour the client
doc actually describes.

## 4. Data model

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

enum AnnouncementStatus { ACTIVE SUPERSEDED DISMISSED }

model Announcement {
  id            String              @id @default(uuid()) @db.Uuid
  userId        String?             @map("user_id") @db.Uuid   // null = broadcast to all
  kind          AnnouncementKind
  status        AnnouncementStatus  @default(ACTIVE)
  title         String
  body          String
  vehicleId     String?             @map("vehicle_id") @db.Uuid
  serviceTypeId String?             @map("service_type_id") @db.Uuid
  appointmentId String?             @map("appointment_id") @db.Uuid
  reason        String?             // TIME | ODOMETER, for SERVICE_DUE
  publishedAt   DateTime            @default(now()) @map("published_at")
  expiresAt     DateTime?           @map("expires_at")
  createdBy     String?             @map("created_by") @db.Uuid
  createdAt     DateTime            @default(now()) @map("created_at")
  updatedAt     DateTime            @updatedAt @map("updated_at")

  @@index([userId, status, publishedAt])
  @@map("announcements")
}
// Plus a PARTIAL unique index, added via raw SQL in the migration (Prisma cannot
// express partial uniques in schema.prisma):
//   CREATE UNIQUE INDEX announcements_open_thread
//     ON announcements (user_id, vehicle_id, service_type_id)
//     WHERE status = 'ACTIVE';

model AnnouncementRead {
  announcementId String   @map("announcement_id") @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  readAt         DateTime @default(now()) @map("read_at")

  @@id([announcementId, userId])
  @@map("announcement_reads")
}
```

**The thread key must be partial, and this is subtle.** The natural key
`(userId, vehicleId, serviceTypeId)` is what enables in-place updating: booking an oil change
finds the existing open thread for (member, vehicle, oil-change) and transitions it rather
than inserting a duplicate. It also gives idempotency for free — the daily job can re-run
safely, exactly as the current `ServiceReminder` unique index does today.

But a **total** unique constraint on those three columns would be wrong: once a thread is
`SUPERSEDED` it stays in the table as history, and the next due cycle six months later could
never open a new thread for the same (member, vehicle, service) — the insert would collide
with the archived row. The constraint must therefore be **partial, scoped to
`status = 'ACTIVE'`**: at most one *open* thread per key, unlimited closed ones behind it.

Prisma cannot express partial unique indexes in `schema.prisma`, so it is added as raw SQL in
the migration, and lookups use `findFirst({ where: { ..., status: "ACTIVE" } })` rather than
`findUnique`.

**Read state as a join table.** Broadcasts have `userId = null` and cannot carry a per-user
`readAt` column, so read tracking lives in `AnnouncementRead` and works uniformly for personal
and broadcast rows.

**Broadcasts and the partial index.** An `ADMIN_BROADCAST` row has `userId`, `vehicleId` and
`serviceTypeId` all null. Postgres treats NULLs as distinct in unique indexes, so many
concurrent broadcasts coexist without collision — the thread constraint simply does not apply
to them.

### 4.1 `ServiceReminder` is replaced, not kept

`ServiceReminder` has exactly three consumers (`reminders.service.ts` ×2,
`attention.service.ts` ×1). Keeping both tables would mean two sources of due-state drifting
apart. `reminders.serviceDue` will write `Announcement` rows directly, and the
`service_reminders` table is dropped in the same migration.

## 5. Thread lifecycle

| Trigger | Effect on the thread |
|---|---|
| `reminders.serviceDue` daily job finds a due (vehicle, serviceType) | Open `SERVICE_DUE` (or leave existing ACTIVE thread untouched) |
| `appointments.book()` for that (vehicle, serviceType) | Transition → `APPOINTMENT_BOOKED`, attach `appointmentId` |
| T-24h / T-2h before `scheduledStart` | Transition → `APPOINTMENT_REMINDER` |
| `appointments.reschedule()` | Transition → `APPOINTMENT_RESCHEDULED`, refresh copy |
| `appointments.cancel()` | Transition → back to `SERVICE_DUE` (the service is due again) |
| Appointment reaches `COMPLETED` | Transition → `SERVICE_COMPLETED`, then `status = SUPERSEDED` |
| Member dismisses | `status = DISMISSED` |

Only `ACTIVE` threads appear in the attention feed. `SUPERSEDED` and `DISMISSED` rows remain
in the announcements list as history, which is what gives the member the "digital record" the
client doc describes.

## 6. Generation points

A new `AnnouncementsService` is driven by an in-process event port modelled on the existing
`WorkOrderEvents` (`apps/api/src/modules/work-orders/work-order-events.ts`) — hand-rolled
callback sets, no new event library, matching current house convention.

- **`reminders.serviceDue`** (existing 08:00 Manila job) — writes `SERVICE_DUE` threads
  instead of `ServiceReminder` rows. Stagger logic is unchanged.
- **`appointments.book/reschedule/cancel`** — emit events the service subscribes to.
- **New `appointments.remindUpcoming` job** — T-24h and T-2h appointment reminders. This is
  FR-090's in-app half and the PDF's "sends a reminder before the appointment", currently
  missing entirely. Runs hourly; idempotent via thread state.
- **`POST /admin/announcements`** — writes an `ADMIN_BROADCAST` row with `userId = null`.

## 7. Attention feed integration

**Decision: Announcements is the single source for `SERVICE_DUE`.**

Scope note — the attention feed aggregates four kinds (`attention.aggregate.ts`):
`COMPONENT_STATUS`, `RECOMMENDATION`, `ENTITLEMENT_EXPIRING`, `SERVICE_DUE`. Only
`SERVICE_DUE` overlaps with announcements. The other three derive from inspection results,
recommendations, and subscription state respectively — they are computed views over domain
data, not messages, and moving them into a notifications table would be a category error.

So: `attention.service.ts`'s `servicesDue()` is rewritten to read `ACTIVE` `SERVICE_DUE`
announcements instead of `ServiceReminder` rows. The other three private feed methods are
untouched. `AttentionItem`'s public contract shape does not change, so the member client needs
no change for this part.

This also fixes an existing wart: today `servicesDue()` sets `dueDate: r.createdAt` with the
comment *"ServiceReminder has no explicit dueDate; treat its creation as the due signal"*, and
computes `overdue` from a comparison that is always true for any row created in the past.
`Announcement.publishedAt` plus the thread state gives an honest value.

## 8. API surface

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/announcements` | Member feed + unread count | Member |
| `POST` | `/announcements/:id/read` | Mark one read | Member |
| `POST` | `/announcements/read-all` | Mark all read | Member |
| `POST` | `/announcements/:id/dismiss` | Dismiss a thread | Member |
| `POST` | `/admin/announcements` | Broadcast (FR-107, per API spec §9.10) | Admin |
| `GET` | `/admin/announcements` | Manage list | Admin |
| `PATCH` | `/admin/announcements/:id` | Edit / unpublish | Admin |

The member feed returns personal rows (`userId = member`) union broadcasts
(`userId = null`, within their published/expiry window), ordered by `publishedAt desc`, each
annotated with `read: boolean` from `AnnouncementRead`.

## 9. Client surfaces

**Member — Announcements screen.** Reached from the Account tab with an unread badge.
Chronological list of threads; each row shows title, body, relative time, unread dot, and
vehicle plate when the thread is vehicle-scoped. Tapping a service-due or appointment thread
deep-links to the relevant booking screen. Built on existing primitives (`Card`,
`StatusPill`, `Plate`, `EmptyState`) per the design system.

**Admin — A-16.** Compose form (title, body, optional expiry), audience selector, list of past
broadcasts with status, publish/unpublish. Audience is **ALL only** for v1; the `userId`-null
convention and the audience concept are designed in so plan-tier or vehicle segmentation can
be added later without a migration.

## 10. Reminder defect fixes

Bundled here because they share the migration and the same test surface.

**Fix 1 — seed the intervals.** Add `intervalDays` / `intervalKm` to `seed-scheduling.ts`
service types, with a regression test asserting every seeded service type intended to generate
reminders carries at least one interval. Proposed manufacturer-typical values:

| Service | intervalDays | intervalKm |
|---|---|---|
| Oil Change | 180 | 5000 |
| Tire Rotation | 180 | 10000 |
| Full Inspection | 365 | 15000 |
| Brake Service | — | 20000 |
| A/C Service | 365 | — |

**Fix 2 — capture the last-service date.** Add optional `lastServiceAt` to
`vehicleCreateSchema` and the `Vehicle` model, collect it in `AddVehicleScreen`, and use it in
`dueCandidates()` as the baseline when no COMPLETED appointment exists — replacing the
`createdAt` fallback. Precedence becomes: last completed appointment → `lastServiceAt` →
`createdAt`.

### 10.1 Service catalogue mismatch (flagged, not fixed here)

`seed-scheduling.ts` seeds Oil Change, Tire Rotation, Brake Service, A/C Service, Full
Inspection. Both the client PDF and SRS §3.12 specify a different catalogue: PMS, Change Oil,
OBD Scanning, Underchassis, Aircon, Mechanics, Body Repair & Repaint, Parts & Accessories.
This is placeholder dev data that must be reconciled before launch, but it is a separate
decision with pricing implications and is **out of scope** for this work.

## 11. Testing

- **Pure thread state machine** — extracted as a pure function over
  (current kind/status, event) → next kind/status, unit-tested across every transition in §5,
  mirroring how `capacity-engine.ts` and the scoring engine are tested.
- **`dueCandidates` baseline precedence** — completed appointment beats `lastServiceAt` beats
  `createdAt`.
- **Seed regression** — every reminder-generating service type has an interval (guards
  Defect 1 from recurring).
- **Idempotency** — re-running `serviceDue` and the T-24h job creates no duplicate threads.
- **Feed authz** — a member sees only their own rows plus broadcasts; never another member's.
- **Attention parity** — `SERVICE_DUE` items produced from announcements match the previous
  `ServiceReminder`-sourced shape.
- **e2e** — book → thread transitions to BOOKED; cancel → returns to DUE; complete →
  SUPERSEDED.

Real-DB e2e runs against Supabase, so tests use prefix-scoped cleanup and never truncate, per
the Phase 3 convention.

## 12. Out of scope

Deferred to Phase 7's notification subsystem:

- Push delivery (FR-090 transport) and FCM device registration
- SMS fallback (FR-091)
- Per-category / per-channel preferences (FR-093)
- Quiet hours (FR-094)
- Send-attempt logging with SMS cost (FR-095)
- 90-day retention policy (FR-092)
- Audience segmentation beyond ALL

**Consequence to state plainly:** until push transport lands, "sends reminders" means in-app
only. The member must open the app to see anything. This work makes the content correct,
persistent and updating; it does not make it reach the device.
