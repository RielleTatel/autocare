# Roadside Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the member-facing roadside emergency path — request, eligibility gate, and live status — plus the advisor dispatch controls it depends on, replacing the Home screen's dead-end "Request" button.

**Architecture:** A new `roadside` Nest module owning a `roadside_requests` table, following the established controller → service → Prisma shape. Eligibility (BR-02) is a guard in the service reading the subscription and its first cleared payment, with time injected via the existing `CLOCK` provider so the 30-day rule is testable. The member app gains two screens (M-26 request, M-27 status), both built around a shared `IncidentMap` component so the member can see and correct the pin before help is dispatched. Status updates reach the member by **polling**, not WebSocket — see Decision D-1 below.

**Tech Stack:** NestJS + Prisma + Zod contracts (existing); React Native / Expo (existing); `expo-location` for the GPS fix and `@rnmapbox/maps` for the interactive map (**two new dependencies**); Mapbox Geocoding and Directions over plain `fetch` (no SDK).

**Spec:**
- [[03 Functional Requirements]] FR-031 → FR-040
- [[02 Overall Description]] BR-02 (eligibility rule)
- [[09 API Specification]] §9.8 (endpoints), §9.11 (events), §9.12 (`ROADSIDE_NOT_ELIGIBLE`)
- [[08 Data Model]] §8.3 (`roadside_requests` field list)
- [[12 Screen Inventory]] M-26, M-27
- [[15 Requirements Traceability Matrix]] FR-031/034/038/040

---

## Global Constraints

- **Money is `BigInt` centavos** in Prisma, serialised by `src/common/bigint-serializer.ts`. Never floats.
- **Time comes from `CLOCK`**, never `new Date()` in service logic — the BR-02 30-day rule must be simulable in tests.
- **Errors are `DomainError(code, message, status)`** with `code` from `packages/contracts/src/errors.ts`. `ROADSIDE_NOT_ELIGIBLE` (403) already exists in that union — do not add it.
- **All responses go through the success envelope**; the API client unwraps `envelope.data`.
- **Global route prefix is `api/v1`**, set in `main.ts`. Contracts/tests use paths without it; `@autocare/api-client` prepends it.
- **Copy is sentence case**, second person for the member's things, and errors name the recovery not the code (NFR-032). Non-eligible states are non-punitive and offer the paid alternative.
- **Touch targets ≥48dp** on member screens (NFR-027).
- **Band colours are never used for non-score meaning** (design principle 1). Roadside status uses semantic/neutral colours only.
- **Staff-role checks live in the service**, via a private `assertStaff`/`assertAdvisor` helper, matching `scheduling-config.service.ts`.

---

## Decisions this plan makes (and why)

**D-1 — Status updates use polling, not Socket.IO (for now).**
[[05 External Interface Requirements]] specifies "WebSocket (Socket.IO) for roadside status… **polling fallback every 15 s**". The repo has *no* WebSocket infrastructure: no `@nestjs/websockets`, no `socket.io`, no `realtime/` module. Building that transport is a larger piece of work than the roadside feature itself and would serve trips and work orders too. This plan implements the specified **polling fallback** (15 s) and leaves the socket layer as a separate project. FR-038 is satisfied — the member sees live status — with a transport swap later confined to one hook.

**D-2 — SI-7 is decided: Mapbox. Reverse geocoding uses the Mapbox Geocoding API.**
SI-7 named "Google Maps or Mapbox" and the vendor decision was open. It is now **Mapbox** (decided 2026-09-11), chosen on billing model rather than sticker price: Mapbox meters mobile by **monthly active users (25,000 free)**, not per map load, and roadside is inherently low-frequency — one member opening the map five times during one incident is one MAU. Google's post-2025 pricing meters Dynamic Maps **per map load** against a 10,000/month per-SKU cap, which is exactly the axis this feature grows on. Mapbox also renders through the GL style spec that **MapLibre** forked, so the exit path is a tile-source-and-SDK swap rather than a rewrite — and Supabase (already this project's database and file host) publishes a first-party guide for serving self-hosted Protomaps tiles. That matters against risk **R-10 (two-vendor lock-in)** and **NFR-036/037 (swappability)**; Google is the only one of the three candidates with no fork to escape to.

Reverse geocoding therefore moves from the OS geocoder to `GET /geocoding/v5/mapbox.places/{lng},{lat}.json`, a single `fetch` with no SDK. FR-032 still mandates that manual landmark entry remains available, and it remains the fallback whenever geocoding returns nothing. See "Third-party dependencies" for the limits of this choice.

**D-3 — v1 renders an interactive map with a draggable pin.**
Superseded 2026-09-11. The original decision deferred all map rendering on the grounds that FR-032 only requires *capturing* a location. That reading is correct but incomplete: a raw GPS fix taken under a covered car park, beside a tall building, or in heavy rain can land tens of metres off, and the only correction channel the keyless design offered was a free-text landmark note. For a feature whose entire job is getting a tow truck to the right place, letting the member **drag the pin to where they actually are** is the difference between a dispatch and a phone call.

This changes what the coordinates *mean*: `lat`/`lng` become **member-confirmed**, not device-reported. The GPS fix seeds the pin; the member's confirmation is what gets stored.

Consequences: `@rnmapbox/maps` (not `react-native-maps`, which does not render Mapbox) is added in Task 7A; a shared `IncidentMap` component is built in Task 9A and embedded read-write in M-26 and read-only in M-27; and FR-039's "distance travelled" becomes computable from the Mapbox Directions API instead of hand-entered by the advisor (Task 13A). The `https://maps.google.com/?q=lat,lng` hand-off stays for the advisor — it costs nothing and staff are used to their own maps app.

**D-4 — Advisor notification is in-app, not push, in this plan.**
FR-036 ("notify on-duty advisors within 30 seconds") ultimately wants FCM. `firebase-admin` is already an API dependency, but there is **no notifications module, no device-token table, and no push plumbing anywhere in the repo** — that is its own project. This plan surfaces new requests in the staff console's existing polling surface and marks FR-036 as partially met. Flagged in "Not covered".

---

## ⚠️ Blocking decision before Task 3

[[AutoCare+ MOC]] Open decisions still lists **"Minimum lock-in period for roadside assistance eligibility"** as unchecked, while BR-02 and FR-034 both state the rule concretely as *first successful payment cleared + 30 days*.

**What the 30 days is for** (asked 2026-09-11, worth recording): it is an **abuse gate**, not a formality. [[13 Constraints and Risks]] files it under "Roadside assistance abuse" — without a waiting period, somebody whose battery is already flat can subscribe from the roadside, claim a free tow, and cancel. Starting the clock at the *first cleared payment* rather than at signup makes that arbitrage cost a full month's fee plus a month's wait, which exceeds what a one-off tow is worth. It works together with BR-01's 6-month lock-in and BR-08's early-termination fee, which are what discourage cancelling once the 30 days have elapsed.

It is open decision **D-2** in [[13 Constraints and Risks#13.5 Open decisions requiring your sign-off]] ("Directly controls abuse exposure", default: 30 days after first cleared payment). If 30 feels wrong, the dials are: shorten it but cap call-outs per cycle through BR-03 entitlements, or keep it and bridge new members with the paid alternative (FR-035).

This plan implements **30 days, read from a named constant** `ROADSIDE_WAITING_DAYS` in `roadside.service.ts`, so changing it is a one-line edit plus a test update. **Confirm the number before Task 3 ships.** If it is still undecided at execution time, build Task 3 as written and raise it — do not guess a different value.

---

## Third-party dependencies

### Required — two new packages

| Package | Where | Why | Cost |
|---|---|---|---|
| `expo-location` | `apps/member` | FR-032 GPS fix + permission flow | Free, no API key |
| `@rnmapbox/maps` | `apps/member` | D-3 interactive map with a draggable pin (M-26, M-27) | Free under 25k mobile MAU |

Install both with `npx expo install` (not `pnpm add` — Expo pins the SDK-compatible version).

`expo-location` needs permission strings. iOS: `NSLocationWhenInUseUsageDescription`. Android: `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION`. Both are set through `app.json` in Task 7 — the app uses `expo-dev-client`, so a native rebuild is required after adding them.

### Mapbox tokens — two of them, and they are not interchangeable

This trips people up, so it is spelled out once here:

| Token | Prefix | Where it lives | What it is for |
|---|---|---|---|
| **Public** | `pk.` | `EXPO_PUBLIC_MAPBOX_TOKEN`, shipped in the app bundle | Runtime: rendering tiles, Geocoding calls |
| **Download** | `sk.` | Build machine / EAS secret only — **never committed, never in `app.json`** | Build time only: authenticates the native SDK download from Mapbox's private registry |

The public token is *designed* to be client-side and shipping it is normal Mapbox practice. Note what that means for security: since the map cannot render without `pk` on the device, **proxying the geocoding call through the API would buy almost nothing** — the token is already in the bundle either way. So Task 8 calls Mapbox Geocoding directly from the app, matching the 1:1 shape of the code it replaces. Mapbox has no mobile referrer restriction, so scope the public token to the minimum required and rotate it if quota usage looks wrong.

**Directions is different** — FR-039 distance is computed when the advisor *resolves* the request, server-side, so Task 13A puts that call in the API where it belongs. The API uses its own token in `MAPBOX_TOKEN` (server env, not `EXPO_PUBLIC_`).

Follow the existing `EXPO_PUBLIC_*` convention already used for `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_POLICY_VERSION` in `apps/member/src/shared/api.ts`.

### Already installed — no action

| Need | Covered by | Note |
|---|---|---|
| FR-040 hotline dialler | `expo-linking` | `Linking.openURL('tel:…')` |
| Advisor opens location in their own maps app | `expo-linking` | Plain `https://maps.google.com/?q=…` URL — kept, see D-3 |
| Deterministic time for BR-02 | `CLOCK` provider | `apps/api/src/common/clock/clock.ts` |
| Auth on new endpoints | `@CurrentUser()` + `AbilityUser` | Global guard already applied |
| FCM transport (when D-4 is revisited) | `firebase-admin` | Installed; no app-level push code exists |

### Deliberately NOT added

| Package | Why not |
|---|---|
| `socket.io` / `@nestjs/websockets` | See D-1 — polling is the spec's own fallback; the socket layer is a separate project spanning trips and work orders |
| `react-native-maps` | Superseded by D-3, but note it does **not** render Mapbox — `@rnmapbox/maps` is the correct package for this vendor |
| Google Maps SDK | See D-2 — SI-7 resolved to Mapbox on billing model and lock-in grounds |
| `@mapbox/search-js` / any Mapbox JS SDK | Geocoding is one `fetch` against a documented REST URL; an SDK adds bundle weight for nothing |
| `expo-notifications` | See D-4 — member-side push is out of scope here |

### The honest limits of D-2

Moving to Mapbox removes the Play-Services and `CLGeocoder` rate-limit problems the on-device geocoder had, but it introduces its own:

- **Street-level coverage in Zamboanga City is unverified.** Mapbox is OpenStreetMap-derived and Google's Philippine street data is generally denser. **Before Task 10 ships, reverse-geocode 5–10 real coordinates across the actual service area and eyeball the results.** This test is cheap and decisive.
- **Geocoding needs a network round-trip.** The on-device geocoder sometimes worked offline; this never does. A member stranded with one bar of signal may get coordinates but no address.
- **Quota is shared across the app**, and a scraped public token consumes it.

Every one of these degrades to the same place it did before: no address string. That is why the landmark note (FR-032) is a first-class field and why `address` is nullable in the schema.

**The seam still holds.** `resolveAddress()` in Task 8 remains the single swap point — if the Zamboanga coverage test comes back poor, you can point *geocoding alone* at Google while Mapbox keeps rendering the tiles. The two decisions are independent and the code is structured to keep them that way.

---

## File structure

| File | Responsibility |
|---|---|
| `packages/contracts/src/roadside.ts` | Zod schemas + inferred types for request, status, eligibility |
| `apps/api/prisma/schema.prisma` | `RoadsideRequest` model, `IncidentType` + `RoadsideStatus` enums |
| `apps/api/src/modules/roadside/roadside.service.ts` | Eligibility (BR-02), create, status transitions, resolve |
| `apps/api/src/modules/roadside/roadside.controller.ts` | Member endpoints |
| `apps/api/src/modules/roadside/roadside-dispatch.controller.ts` | Advisor/driver endpoints |
| `apps/api/src/modules/roadside/roadside.module.ts` | Wiring |
| `apps/member/src/features/roadside/roadsideApi.ts` | Typed client calls |
| `apps/member/src/features/roadside/useRoadsideStatus.ts` | 15 s polling hook |
| `apps/member/src/features/roadside/location.ts` | GPS fix + Mapbox reverse geocode, permission handling |
| `apps/member/src/features/roadside/IncidentMap.tsx` | Shared map: draggable pin (M-26) / read-only (M-27) |
| `apps/api/src/modules/roadside/route-distance.ts` | FR-039 distance via Mapbox Directions |
| `apps/member/src/features/roadside/RoadsideRequestScreen.tsx` | M-26 |
| `apps/member/src/features/roadside/RoadsideStatusScreen.tsx` | M-27 |
| `apps/member/src/features/roadside/RoadsideContainer.tsx` | Orchestrates eligibility → request → status |

---

## Task 1: Contracts

**Files:**
- Create: `packages/contracts/src/roadside.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/roadside.test.ts`

**Interfaces:**
- Produces: `incidentTypes`, `roadsideStatuses`, `roadsideRequestSchema`/`RoadsideRequestInput`, `roadsideStatusSchema`/`RoadsideStatusInput`, `RoadsideEligibility`, `RoadsideRequestView`

- [ ] **Step 1: Write the failing test**

```ts
// packages/contracts/src/roadside.test.ts
import { describe, expect, it } from "vitest";
import { roadsideRequestSchema, roadsideStatusSchema, incidentTypes, roadsideStatuses } from "./roadside";

describe("roadside contracts", () => {
  it("accepts a request with coordinates and an incident type", () => {
    const r = roadsideRequestSchema.parse({
      vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
      incidentType: "FLAT_TYRE",
      lat: 6.9214,
      lng: 122.0790,
      address: "Governor Camins Ave, Zamboanga City",
      landmarkNote: "Beside the blue gate",
    });
    expect(r.incidentType).toBe("FLAT_TYRE");
  });

  it("allows a request with no address when geocoding fails, as long as a landmark is given", () => {
    const r = roadsideRequestSchema.parse({
      vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
      incidentType: "OTHER",
      lat: 6.9214,
      lng: 122.0790,
      landmarkNote: "Opposite the covered court",
    });
    expect(r.address).toBeUndefined();
  });

  it("rejects coordinates outside the valid range", () => {
    expect(() => roadsideRequestSchema.parse({
      vehicleId: "3f1a0c9e-0000-4000-8000-000000000001",
      incidentType: "FLAT_TYRE", lat: 200, lng: 0,
    })).toThrow();
  });

  it("covers every incident type the spec lists (FR-033)", () => {
    expect([...incidentTypes]).toEqual([
      "FLAT_TYRE", "DEAD_BATTERY", "OUT_OF_FUEL", "OVERHEATING", "WILL_NOT_START", "ACCIDENT", "OTHER",
    ]);
  });

  it("covers the six-state lifecycle (FR-038)", () => {
    expect([...roadsideStatuses]).toEqual([
      "REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE", "RESOLVED",
    ]);
  });

  it("rejects a status transition payload with an unknown status", () => {
    expect(() => roadsideStatusSchema.parse({ status: "LOST" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/contracts && npx vitest run src/roadside.test.ts`
Expected: FAIL — `Failed to resolve import "./roadside"`

- [ ] **Step 3: Write the implementation**

```ts
// packages/contracts/src/roadside.ts
import { z } from "zod";

/** FR-033 — the incident types a member may choose. */
export const incidentTypes = [
  "FLAT_TYRE", "DEAD_BATTERY", "OUT_OF_FUEL", "OVERHEATING", "WILL_NOT_START", "ACCIDENT", "OTHER",
] as const;
export type IncidentType = (typeof incidentTypes)[number];

/** FR-038 — the status timeline shown to the member, in order. */
export const roadsideStatuses = [
  "REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE", "RESOLVED",
] as const;
export type RoadsideStatus = (typeof roadsideStatuses)[number];

/**
 * `address` is optional because reverse geocoding is best-effort (see plan D-2):
 * a device without Play Services, or a rate-limited geocoder, still has to be
 * able to raise an emergency. `landmarkNote` is how a member describes where
 * they are when the machine cannot (FR-032).
 */
export const roadsideRequestSchema = z.object({
  vehicleId: z.string().uuid(),
  incidentType: z.enum(incidentTypes),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: z.string().max(300).optional(),
  landmarkNote: z.string().max(300).optional(),
});
export type RoadsideRequestInput = z.infer<typeof roadsideRequestSchema>;

export const roadsideStatusSchema = z.object({
  status: z.enum(roadsideStatuses),
  etaMinutes: z.number().int().min(0).max(600).optional(),
});
export type RoadsideStatusInput = z.infer<typeof roadsideStatusSchema>;

export const roadsideDispatchSchema = z.object({
  responderUserId: z.string().uuid().optional(),
  responderName: z.string().min(2).max(120),
  etaMinutes: z.number().int().min(0).max(600).optional(),
});
export type RoadsideDispatchInput = z.infer<typeof roadsideDispatchSchema>;

export const roadsideResolveSchema = z.object({
  resolutionNotes: z.string().min(3).max(1000),
  costCentavos: z.number().int().min(0),
});
export type RoadsideResolveInput = z.infer<typeof roadsideResolveSchema>;

/** FR-034/FR-035 — why the button is or is not available, in the member's words. */
export type RoadsideEligibility = {
  eligible: boolean;
  /** Present when `eligible` is false: a non-punitive explanation. */
  reason?: string;
  /** Remaining covered call-outs this cycle, when known. */
  remainingCallouts?: number | null;
  /** ISO date the waiting period ends, when that is what is blocking. */
  eligibleFrom?: string | null;
  /** FR-035 — what a non-eligible member can do instead. */
  paidAlternativeCentavos?: number | null;
};

export type RoadsideRequestView = {
  id: string;
  vehicleId: string;
  incidentType: IncidentType;
  lat: number;
  lng: number;
  address: string | null;
  landmarkNote: string | null;
  status: RoadsideStatus;
  responderName: string | null;
  etaMinutes: number | null;
  createdAt: string;
  resolvedAt: string | null;
};
```

- [ ] **Step 4: Export from the barrel**

Add to `packages/contracts/src/index.ts`, keeping the file's alphabetical grouping:

```ts
export * from "./roadside";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/contracts && npx vitest run src/roadside.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Build the package so consumers see the types**

Run: `cd packages/contracts && npm run build`
Expected: no output, exit 0

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/roadside.ts packages/contracts/src/roadside.test.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): roadside request, status and eligibility schemas"
```

---

## Task 2: Prisma model and migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via CLI

**Interfaces:**
- Consumes: `IncidentType` / `RoadsideStatus` value sets from Task 1 (mirrored as Prisma enums)
- Produces: `prisma.roadsideRequest` with fields `id, userId, vehicleId, incidentType, lat, lng, address, landmarkNote, status, dispatchedToUserId, responderName, etaMinutes, resolutionNotes, costCentavos, createdAt, acknowledgedAt, resolvedAt`

- [ ] **Step 1: Add the enums and model**

Append to `apps/api/prisma/schema.prisma`. Field names follow [[08 Data Model]] §8.3 line 140; `@@map` to snake_case as every other model does.

```prisma
// ---------------------------------------------------------------------------
// Roadside assistance (FR-031 → FR-040)
// ---------------------------------------------------------------------------

enum IncidentType {
  FLAT_TYRE
  DEAD_BATTERY
  OUT_OF_FUEL
  OVERHEATING
  WILL_NOT_START
  ACCIDENT
  OTHER
}

enum RoadsideStatus {
  REQUESTED
  ACKNOWLEDGED
  DISPATCHED
  EN_ROUTE
  ON_SITE
  RESOLVED
}

model RoadsideRequest {
  id                 String         @id @default(uuid()) @db.Uuid
  userId             String         @map("user_id") @db.Uuid
  user               User           @relation(fields: [userId], references: [id])
  vehicleId          String         @map("vehicle_id") @db.Uuid
  vehicle            Vehicle        @relation(fields: [vehicleId], references: [id])
  incidentType       IncidentType   @map("incident_type")
  lat                Float
  lng                Float
  address            String?
  landmarkNote       String?        @map("landmark_note")
  status             RoadsideStatus @default(REQUESTED)
  dispatchedToUserId String?        @map("dispatched_to") @db.Uuid
  responderName      String?        @map("responder_name")
  etaMinutes         Int?           @map("eta_minutes")
  resolutionNotes    String?        @map("resolution_notes")
  costCentavos       BigInt?        @map("cost_centavos")
  createdAt          DateTime       @default(now()) @map("created_at")
  acknowledgedAt     DateTime?      @map("acknowledged_at")
  resolvedAt         DateTime?      @map("resolved_at")

  // The dispatch board reads open requests oldest-first; the member's own
  // history reads by user. Both are hot paths on an emergency screen.
  @@index([status, createdAt])
  @@index([userId, createdAt])
  @@map("roadside_requests")
}
```

- [ ] **Step 2: Add the back-relations**

Prisma will not compile a relation without both sides. In `model User`, add:

```prisma
  roadsideRequests RoadsideRequest[]
```

In `model Vehicle`, add:

```prisma
  roadsideRequests RoadsideRequest[]
```

- [ ] **Step 3: Verify the schema compiles**

Run: `cd apps/api && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create the migration**

Run: `cd apps/api && npx prisma migrate dev --name roadside_requests`
Expected: migration created and applied; Prisma Client regenerated.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): roadside_requests model and migration"
```

---

## Task 3: Eligibility guard (BR-02)

**Files:**
- Create: `apps/api/src/modules/roadside/roadside.service.ts`
- Test: `apps/api/src/modules/roadside/roadside.service.spec.ts`

**Interfaces:**
- Consumes: `RoadsideEligibility` (Task 1); `prisma.roadsideRequest` (Task 2); `CLOCK` from `src/common/clock/clock.ts`
- Produces: `RoadsideService.eligibility(userId: string): Promise<RoadsideEligibility>`, and the exported constant `ROADSIDE_WAITING_DAYS`

> **Confirm `ROADSIDE_WAITING_DAYS` before shipping this task** — see the blocking-decision note above.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/roadside/roadside.service.spec.ts
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK } from "../../common/clock/clock";
import { RoadsideService, ROADSIDE_WAITING_DAYS } from "./roadside.service";

const DAY = 86_400_000;
const NOW = new Date("2026-06-01T00:00:00Z");

/** Minimal Prisma stand-in: only the reads `eligibility` performs. */
function prismaStub(over: Partial<Record<string, any>> = {}) {
  return {
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: { findFirst: jest.fn().mockResolvedValue(null) },
    ...over,
  } as unknown as PrismaService;
}

async function build(prisma: PrismaService) {
  const mod = await Test.createTestingModule({
    providers: [
      RoadsideService,
      { provide: PrismaService, useValue: prisma },
      { provide: CLOCK, useValue: { now: () => NOW } },
    ],
  }).compile();
  return mod.get(RoadsideService);
}

describe("RoadsideService.eligibility (BR-02, FR-034/FR-035)", () => {
  it("refuses a member with no active subscription, and says what to do instead", async () => {
    const svc = await build(prismaStub());
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/subscription/i);
  });

  it("refuses when no payment has cleared yet", async () => {
    const svc = await build(prismaStub({
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 90 * DAY) }) },
    }));
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/payment/i);
  });

  // The rule is measured from the cleared payment, NOT from signup — a member
  // who subscribed months ago but only just paid is still inside the window.
  it("refuses while inside the waiting period, and names the date it opens", async () => {
    const paidAt = new Date(NOW.getTime() - 10 * DAY);
    const svc = await build(prismaStub({
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 200 * DAY) }) },
      payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
    }));
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(false);
    expect(r.eligibleFrom).toBe(new Date(paidAt.getTime() + ROADSIDE_WAITING_DAYS * DAY).toISOString());
  });

  it("allows once the waiting period has elapsed", async () => {
    const paidAt = new Date(NOW.getTime() - (ROADSIDE_WAITING_DAYS + 1) * DAY);
    const svc = await build(prismaStub({
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: paidAt }) },
      payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
    }));
    const r = await svc.eligibility("user-1");
    expect(r.eligible).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("treats the boundary day as eligible", async () => {
    const paidAt = new Date(NOW.getTime() - ROADSIDE_WAITING_DAYS * DAY);
    const svc = await build(prismaStub({
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: paidAt }) },
      payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
    }));
    expect((await svc.eligibility("user-1")).eligible).toBe(true);
  });

  it("refuses a suspended subscription even after the waiting period", async () => {
    const paidAt = new Date(NOW.getTime() - 200 * DAY);
    const svc = await build(prismaStub({
      subscription: { findFirst: jest.fn().mockResolvedValue(null) }, // findFirst filters on status
      payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: paidAt }) },
    }));
    expect((await svc.eligibility("user-1")).eligible).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts`
Expected: FAIL — cannot find module `./roadside.service`

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/modules/roadside/roadside.service.ts
import { Inject, Injectable } from "@nestjs/common";
import type { RoadsideEligibility } from "@autocare/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { CLOCK, type Clock } from "../../common/clock/clock";

/**
 * BR-02 waiting period, in days, measured from the first cleared payment.
 *
 * Named rather than inlined because [[AutoCare+ MOC]] still carries
 * "minimum lock-in period for roadside assistance eligibility" as an open
 * decision, while BR-02 and FR-034 state 30. Change here, change the tests,
 * change nothing else.
 */
export const ROADSIDE_WAITING_DAYS = 30;

const DAY_MS = 86_400_000;

/** Statuses that still count as covered. GRACE keeps a late payer covered. */
const COVERED_STATUSES = ["ACTIVE", "GRACE"] as const;

@Injectable()
export class RoadsideService {
  constructor(
    private prisma: PrismaService,
    @Inject(CLOCK) private clock: Clock,
  ) {}

  /**
   * FR-034 / FR-035 — may this member raise a request, and if not, why not in
   * words they can act on. Never returns a bare "no": every refusal carries
   * either a date or an alternative.
   */
  async eligibility(userId: string): Promise<RoadsideEligibility> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: [...COVERED_STATUSES] } },
      select: { id: true, status: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    });

    if (!subscription) {
      return {
        eligible: false,
        reason: "Roadside assistance comes with an active subscription. Start a plan and it unlocks after your first payment clears.",
      };
    }

    // BR-02 is measured from money actually clearing, not from signup: a
    // subscription can exist for months with a failed card behind it.
    const firstCleared = await this.prisma.payment.findFirst({
      where: { status: "SUCCEEDED", invoice: { subscriptionId: subscription.id } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    if (!firstCleared) {
      return {
        eligible: false,
        reason: "Roadside assistance unlocks once your first payment clears. We'll let you know as soon as it does.",
      };
    }

    const opensAt = new Date(firstCleared.createdAt.getTime() + ROADSIDE_WAITING_DAYS * DAY_MS);
    if (this.clock.now() < opensAt) {
      return {
        eligible: false,
        eligibleFrom: opensAt.toISOString(),
        reason: `Roadside assistance opens ${ROADSIDE_WAITING_DAYS} days after your first payment. You're covered from ${opensAt.toISOString().slice(0, 10)}.`,
      };
    }

    return { eligible: true };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/roadside/
git commit -m "feat(api): BR-02 roadside eligibility guard"
```

---

## Task 4: Create a request

**Files:**
- Modify: `apps/api/src/modules/roadside/roadside.service.ts`
- Test: `apps/api/src/modules/roadside/roadside.service.spec.ts` (append a describe block)

**Interfaces:**
- Consumes: `RoadsideRequestInput`, `RoadsideRequestView` (Task 1); `RoadsideService.eligibility` (Task 3)
- Produces: `RoadsideService.create(userId: string, dto: RoadsideRequestInput): Promise<RoadsideRequestView>`, `RoadsideService.active(userId: string): Promise<RoadsideRequestView | null>`, `RoadsideService.byId(userId: string, id: string): Promise<RoadsideRequestView>`

- [ ] **Step 1: Write the failing test**

Append to `roadside.service.spec.ts`:

```ts
describe("RoadsideService.create (FR-031 → FR-034)", () => {
  const eligibleStub = () => prismaStub({
    subscription: { findFirst: jest.fn().mockResolvedValue({ id: "sub-1", status: "ACTIVE", startedAt: new Date(NOW.getTime() - 200 * DAY) }) },
    payment: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date(NOW.getTime() - 200 * DAY) }) },
    vehicle: { findFirst: jest.fn().mockResolvedValue({ id: "veh-1" }) },
    roadsideRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => ({
        ...data, id: "rr-1", status: "REQUESTED", createdAt: NOW,
        address: data.address ?? null, landmarkNote: data.landmarkNote ?? null,
        responderName: null, etaMinutes: null, resolvedAt: null,
      })),
    },
  });

  const dto = {
    vehicleId: "veh-1", incidentType: "FLAT_TYRE" as const,
    lat: 6.9214, lng: 122.0790, landmarkNote: "Beside the blue gate",
  };

  it("records a request for an eligible member", async () => {
    const svc = await build(eligibleStub());
    const r = await svc.create("user-1", dto);
    expect(r.id).toBe("rr-1");
    expect(r.status).toBe("REQUESTED");
  });

  it("refuses an ineligible member with ROADSIDE_NOT_ELIGIBLE", async () => {
    const svc = await build(prismaStub());
    await expect(svc.create("user-1", dto)).rejects.toMatchObject({ code: "ROADSIDE_NOT_ELIGIBLE", status: 403 });
  });

  it("refuses a vehicle the member does not own", async () => {
    const p = eligibleStub();
    (p as any).vehicle.findFirst = jest.fn().mockResolvedValue(null);
    const svc = await build(p);
    await expect(svc.create("user-1", dto)).rejects.toMatchObject({ code: "FORBIDDEN_ROLE" });
  });

  // A panicking member taps twice. The second tap must not open a second
  // incident for advisors to chase.
  it("returns the existing open request instead of opening a second one", async () => {
    const p = eligibleStub();
    const open = {
      id: "rr-existing", userId: "user-1", vehicleId: "veh-1", incidentType: "FLAT_TYRE",
      lat: 6.9, lng: 122.0, address: null, landmarkNote: null, status: "DISPATCHED",
      responderName: null, etaMinutes: null, createdAt: NOW, resolvedAt: null,
    };
    (p as any).roadsideRequest.findFirst = jest.fn().mockResolvedValue(open);
    const svc = await build(p);
    const r = await svc.create("user-1", dto);
    expect(r.id).toBe("rr-existing");
    expect((p as any).roadsideRequest.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts -t "create"`
Expected: FAIL — `svc.create is not a function`

- [ ] **Step 3: Write the implementation**

Add to `roadside.service.ts` (imports first):

```ts
import type { RoadsideRequestInput, RoadsideRequestView } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
```

```ts
  /** Statuses before RESOLVED — a member may only have one of these at a time. */
  private static readonly OPEN_STATUSES = [
    "REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE",
  ] as const;

  private view(r: {
    id: string; vehicleId: string; incidentType: string; lat: number; lng: number;
    address: string | null; landmarkNote: string | null; status: string;
    responderName: string | null; etaMinutes: number | null;
    createdAt: Date; resolvedAt: Date | null;
  }): RoadsideRequestView {
    return {
      id: r.id,
      vehicleId: r.vehicleId,
      incidentType: r.incidentType as RoadsideRequestView["incidentType"],
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      landmarkNote: r.landmarkNote,
      status: r.status as RoadsideRequestView["status"],
      responderName: r.responderName,
      etaMinutes: r.etaMinutes,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    };
  }

  /** The member's live incident, if any. Drives M-27 and the Home card. */
  async active(userId: string): Promise<RoadsideRequestView | null> {
    const open = await this.prisma.roadsideRequest.findFirst({
      where: { userId, status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    return open ? this.view(open) : null;
  }

  async byId(userId: string, id: string): Promise<RoadsideRequestView> {
    const r = await this.prisma.roadsideRequest.findFirst({ where: { id, userId } });
    if (!r) throw new DomainError("FORBIDDEN_ROLE", "Request not found", 404);
    return this.view(r);
  }

  /**
   * FR-031 → FR-034. Eligibility is checked here rather than only in the UI:
   * the button is the one thing a member reaches for in an emergency, and it
   * must not be possible to get past it by replaying the request.
   */
  async create(userId: string, dto: RoadsideRequestInput): Promise<RoadsideRequestView> {
    const eligibility = await this.eligibility(userId);
    if (!eligibility.eligible) {
      throw new DomainError("ROADSIDE_NOT_ELIGIBLE", eligibility.reason ?? "Roadside assistance is not available on your plan yet.", 403);
    }

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, ownerUserId: userId },
      select: { id: true },
    });
    if (!vehicle) throw new DomainError("FORBIDDEN_ROLE", "That vehicle is not on your account.", 403);

    // Idempotent by situation rather than by key: a second tap during an
    // emergency means "did it work?", not "send another truck".
    const open = await this.prisma.roadsideRequest.findFirst({
      where: { userId, status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "desc" },
    });
    if (open) return this.view(open);

    const created = await this.prisma.roadsideRequest.create({
      data: {
        userId,
        vehicleId: dto.vehicleId,
        incidentType: dto.incidentType,
        lat: dto.lat,
        lng: dto.lng,
        address: dto.address ?? null,
        landmarkNote: dto.landmarkNote ?? null,
      },
    });
    return this.view(created);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/roadside/
git commit -m "feat(api): create and read roadside requests"
```

---

## Task 5: Dispatch and status transitions

**Files:**
- Modify: `apps/api/src/modules/roadside/roadside.service.ts`
- Test: `apps/api/src/modules/roadside/roadside.service.spec.ts` (append)

**Interfaces:**
- Consumes: `RoadsideDispatchInput`, `RoadsideStatusInput`, `RoadsideResolveInput` (Task 1)
- Produces: `RoadsideService.board(u: AbilityUser)`, `.dispatch(u, id, dto)`, `.setStatus(u, id, dto)`, `.resolve(u, id, dto)`

- [ ] **Step 1: Write the failing test**

Append to `roadside.service.spec.ts`:

```ts
describe("RoadsideService dispatch and status (FR-037 → FR-039)", () => {
  const advisor = { id: "adv-1", role: "ADVISOR" as const };
  const member = { id: "user-1", role: "MEMBER" as const };

  const withRequest = (status = "REQUESTED") => prismaStub({
    roadsideRequest: {
      findUnique: jest.fn().mockResolvedValue({ id: "rr-1", status }),
      findMany: jest.fn().mockResolvedValue([{ id: "rr-1", status }]),
      update: jest.fn().mockImplementation(({ data }: any) => ({
        id: "rr-1", vehicleId: "veh-1", incidentType: "FLAT_TYRE", lat: 6.9, lng: 122.0,
        address: null, landmarkNote: null, responderName: null, etaMinutes: null,
        createdAt: NOW, resolvedAt: null, ...data,
      })),
    },
  });

  it("refuses a member trying to reach the dispatch board", async () => {
    const svc = await build(withRequest());
    await expect(svc.board(member)).rejects.toMatchObject({ code: "FORBIDDEN_ROLE", status: 403 });
  });

  it("lets an advisor assign a responder and moves the request to DISPATCHED", async () => {
    const svc = await build(withRequest("ACKNOWLEDGED"));
    const r = await svc.dispatch(advisor, "rr-1", { responderName: "J. Cruz", etaMinutes: 25 });
    expect(r.status).toBe("DISPATCHED");
    expect(r.responderName).toBe("J. Cruz");
    expect(r.etaMinutes).toBe(25);
  });

  it("walks the timeline forward", async () => {
    const svc = await build(withRequest("DISPATCHED"));
    const r = await svc.setStatus(advisor, "rr-1", { status: "EN_ROUTE" });
    expect(r.status).toBe("EN_ROUTE");
  });

  // The member watches this timeline. Letting it run backwards would tell
  // them a truck that had arrived is somehow on its way again.
  it("refuses a backwards transition", async () => {
    const svc = await build(withRequest("ON_SITE"));
    await expect(svc.setStatus(advisor, "rr-1", { status: "DISPATCHED" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("refuses any transition once resolved", async () => {
    const svc = await build(withRequest("RESOLVED"));
    await expect(svc.setStatus(advisor, "rr-1", { status: "EN_ROUTE" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("records the resolution and stamps resolvedAt", async () => {
    const svc = await build(withRequest("ON_SITE"));
    const r = await svc.resolve(advisor, "rr-1", { resolutionNotes: "Tyre changed on site", costCentavos: 45000 });
    expect(r.status).toBe("RESOLVED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts -t "dispatch and status"`
Expected: FAIL — `svc.board is not a function`

- [ ] **Step 3: Write the implementation**

Add the import:

```ts
import type { AbilityUser } from "../../common/policies/ability.factory";
import type { RoadsideDispatchInput, RoadsideResolveInput, RoadsideStatusInput } from "@autocare/contracts";
```

```ts
/** Roles that may work an incident. Mirrors scheduling-config.service.ts. */
const DISPATCH_ROLES = new Set(["ADVISOR", "ADMIN", "DRIVER"]);

/** FR-038 order. Index position is the rule: a transition must move forward. */
const STATUS_ORDER = [
  "REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE", "RESOLVED",
] as const;
```

Then, as methods on `RoadsideService`:

```ts
  private assertDispatcher(u: AbilityUser): void {
    if (!DISPATCH_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }

  private async loadOpen(id: string) {
    const r = await this.prisma.roadsideRequest.findUnique({ where: { id } });
    if (!r) throw new DomainError("FORBIDDEN_ROLE", "Request not found", 404);
    return r;
  }

  /** FR-036 surface — open incidents, oldest first, because they are a queue. */
  async board(u: AbilityUser): Promise<RoadsideRequestView[]> {
    this.assertDispatcher(u);
    const rows = await this.prisma.roadsideRequest.findMany({
      where: { status: { in: [...RoadsideService.OPEN_STATUSES] } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.view(r));
  }

  async dispatch(u: AbilityUser, id: string, dto: RoadsideDispatchInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);
    if (current.status === "RESOLVED") throw new DomainError("DUPLICATE_REQUEST", "That request is already resolved.", 409);

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: "DISPATCHED",
        dispatchedToUserId: dto.responderUserId ?? null,
        responderName: dto.responderName,
        etaMinutes: dto.etaMinutes ?? null,
        acknowledgedAt: current.acknowledgedAt ?? this.clock.now(),
      },
    });
    return this.view(updated);
  }

  async setStatus(u: AbilityUser, id: string, dto: RoadsideStatusInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);

    const from = STATUS_ORDER.indexOf(current.status as (typeof STATUS_ORDER)[number]);
    const to = STATUS_ORDER.indexOf(dto.status);
    if (to <= from) {
      throw new DomainError(
        "DUPLICATE_REQUEST",
        `A request cannot move from ${current.status} back to ${dto.status}.`,
        409,
      );
    }

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: dto.status,
        etaMinutes: dto.etaMinutes ?? current.etaMinutes,
        acknowledgedAt: current.acknowledgedAt ?? this.clock.now(),
        resolvedAt: dto.status === "RESOLVED" ? this.clock.now() : null,
      },
    });
    return this.view(updated);
  }

  /** FR-039 — outcome and cost, for the FR-099 roadside-cost report. */
  async resolve(u: AbilityUser, id: string, dto: RoadsideResolveInput): Promise<RoadsideRequestView> {
    this.assertDispatcher(u);
    const current = await this.loadOpen(id);
    if (current.status === "RESOLVED") throw new DomainError("DUPLICATE_REQUEST", "That request is already resolved.", 409);

    const updated = await this.prisma.roadsideRequest.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolutionNotes: dto.resolutionNotes,
        costCentavos: BigInt(dto.costCentavos),
        resolvedAt: this.clock.now(),
      },
    });
    return this.view(updated);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/modules/roadside/roadside.service.spec.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/roadside/
git commit -m "feat(api): roadside dispatch, status timeline and resolution"
```

---

## Task 6: Controllers, module wiring, and e2e

**Files:**
- Create: `apps/api/src/modules/roadside/roadside.controller.ts`
- Create: `apps/api/src/modules/roadside/roadside-dispatch.controller.ts`
- Create: `apps/api/src/modules/roadside/roadside.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/roadside.e2e-spec.ts`

**Interfaces:**
- Consumes: every `RoadsideService` method from Tasks 3–5
- Produces: the §9.8 routes — `GET /roadside/eligibility`, `POST /roadside/requests`, `GET /roadside/requests/active`, `GET /roadside/requests/:id`, `GET /roadside/board`, `POST /roadside/requests/:id/dispatch`, `PATCH /roadside/requests/:id/status`, `POST /roadside/requests/:id/resolve`

- [ ] **Step 1: Write the member controller**

```ts
// apps/api/src/modules/roadside/roadside.controller.ts
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { roadsideRequestSchema, type RoadsideRequestInput } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { RoadsideService } from "./roadside.service";

@Controller("roadside")
export class RoadsideController {
  constructor(private roadside: RoadsideService) {}

  /** FR-034 — the app asks before showing the button, so the refusal is calm. */
  @Get("eligibility")
  eligibility(@CurrentUser() u: AbilityUser) {
    return this.roadside.eligibility(u.id);
  }

  @Post("requests")
  create(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(roadsideRequestSchema)) dto: RoadsideRequestInput) {
    return this.roadside.create(u.id, dto);
  }

  /** Drives M-27 and the Home card's live state. Null when nothing is open. */
  @Get("requests/active")
  active(@CurrentUser() u: AbilityUser) {
    return this.roadside.active(u.id);
  }

  @Get("requests/:id")
  byId(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.roadside.byId(u.id, id);
  }
}
```

- [ ] **Step 2: Write the dispatch controller**

```ts
// apps/api/src/modules/roadside/roadside-dispatch.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  roadsideDispatchSchema, roadsideResolveSchema, roadsideStatusSchema,
  type RoadsideDispatchInput, type RoadsideResolveInput, type RoadsideStatusInput,
} from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AbilityUser } from "../../common/policies/ability.factory";
import { RoadsideService } from "./roadside.service";

@Controller("roadside")
export class RoadsideDispatchController {
  constructor(private roadside: RoadsideService) {}

  @Get("board")
  board(@CurrentUser() u: AbilityUser) {
    return this.roadside.board(u);
  }

  @Post("requests/:id/dispatch")
  dispatch(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideDispatchSchema)) dto: RoadsideDispatchInput,
  ) {
    return this.roadside.dispatch(u, id, dto);
  }

  @Patch("requests/:id/status")
  setStatus(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideStatusSchema)) dto: RoadsideStatusInput,
  ) {
    return this.roadside.setStatus(u, id, dto);
  }

  @Post("requests/:id/resolve")
  resolve(
    @CurrentUser() u: AbilityUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roadsideResolveSchema)) dto: RoadsideResolveInput,
  ) {
    return this.roadside.resolve(u, id, dto);
  }
}
```

- [ ] **Step 3: Write the module and register it**

```ts
// apps/api/src/modules/roadside/roadside.module.ts
import { Module } from "@nestjs/common";
import { RoadsideService } from "./roadside.service";
import { RoadsideController } from "./roadside.controller";
import { RoadsideDispatchController } from "./roadside-dispatch.controller";

// No `imports` array: ClockModule and PrismaModule are both @Global(), so
// @Inject(CLOCK) and PrismaService resolve without importing them here. Adding
// them would work but breaks the pattern every other module follows.
@Module({
  controllers: [RoadsideController, RoadsideDispatchController],
  providers: [RoadsideService],
  exports: [RoadsideService],
})
export class RoadsideModule {}
```

In `apps/api/src/app.module.ts`, add the import at the top and `RoadsideModule` to the `imports` array immediately after `AnnouncementsModule`.

- [ ] **Step 4: Write the e2e test**

```ts
// apps/api/test/roadside.e2e-spec.ts
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";

describe("roadside (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async () => ({ uid: "fb-roadside-1", email: "roadside@test.local" }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer t");
  });
  afterAll(() => app.close());

  it("reports a fresh member as not eligible, with a reason rather than a bare no", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/eligibility").set("Authorization", "Bearer t").expect(200);
    expect(res.body.data.eligible).toBe(false);
    expect(typeof res.body.data.reason).toBe("string");
    expect(res.body.data.reason.length).toBeGreaterThan(10);
  });

  it("refuses an ineligible request with ROADSIDE_NOT_ELIGIBLE", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/roadside/requests").set("Authorization", "Bearer t")
      .send({ vehicleId: "3f1a0c9e-0000-4000-8000-000000000001", incidentType: "FLAT_TYRE", lat: 6.9214, lng: 122.079 })
      .expect(403);
    expect(res.body.error.code).toBe("ROADSIDE_NOT_ELIGIBLE");
  });

  it("rejects a malformed body before it reaches the service", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/roadside/requests").set("Authorization", "Bearer t")
      .send({ vehicleId: "not-a-uuid", incidentType: "NOPE", lat: 999, lng: 0 })
      .expect(400);
  });

  it("keeps the dispatch board away from members", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/board").set("Authorization", "Bearer t").expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("returns null when the member has no live incident", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/roadside/requests/active").set("Authorization", "Bearer t").expect(200);
    expect(res.body.data).toBeNull();
  });
});
```

- [ ] **Step 5: Run the e2e test**

Run: `cd apps/api && npx jest test/roadside.e2e-spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Run the whole API suite for regressions**

Run: `cd apps/api && npx jest`
Expected: all suites pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/roadside/ apps/api/src/app.module.ts apps/api/test/roadside.e2e-spec.ts
git commit -m "feat(api): roadside endpoints per API spec 9.8"
```

---

## Task 7: Add `expo-location` and its permissions

**Files:**
- Modify: `apps/member/package.json` (via CLI)
- Modify: `apps/member/app.json`

**Interfaces:**
- Produces: `expo-location` available to Task 8; iOS/Android permission strings declared

- [ ] **Step 1: Install with the Expo CLI**

Run: `cd apps/member && npx expo install expo-location`

Use `expo install`, not `pnpm add` — it resolves the version matching Expo SDK 57. Anything else risks a native mismatch at build time.

- [ ] **Step 2: Declare the permissions**

In `apps/member/app.json`, inside `expo.ios`, add (creating `infoPlist` if absent):

```json
"infoPlist": {
  "NSLocationWhenInUseUsageDescription": "AutoCare+ uses your location so we can send help to the right place when you request roadside assistance."
}
```

Inside `expo.android`, add:

```json
"permissions": ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
```

Also add the plugin entry to `expo.plugins`:

```json
["expo-location", { "locationAlwaysAndWhenInUsePermission": "AutoCare+ uses your location so we can send help to the right place when you request roadside assistance." }]
```

- [ ] **Step 3: Verify the config parses**

Run: `cd apps/member && npx expo config --type public > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/member/package.json apps/member/app.json ../../pnpm-lock.yaml
git commit -m "chore(member): add expo-location for roadside GPS capture"
```

> **Native rebuild required.** The app uses `expo-dev-client`, so a new permission needs a fresh dev build before Task 8 can run on a device. A JS reload is not enough. **Do Task 7A before you rebuild** — it adds a second native module, and one rebuild can cover both.

---

## Task 7A: Add `@rnmapbox/maps` and its tokens

> Lettered rather than renumbered so that every "Task N" reference elsewhere in this plan, and in [[15 Requirements Traceability Matrix]], still points where it did.

**Files:**
- Modify: `apps/member/package.json` (via CLI)
- Modify: `apps/member/app.json`
- Modify: `apps/member/.env.example`

**Interfaces:**
- Produces: `@rnmapbox/maps` available to Task 9A; `EXPO_PUBLIC_MAPBOX_TOKEN` readable at runtime

- [ ] **Step 1: Get the two tokens**

In the Mapbox account dashboard create:
1. A **public** token (`pk.…`) with the default public scopes.
2. A **download** token (`sk.…`) with the `DOWNLOADS:READ` scope. This one is secret.

Confirm the account is on the free tier and note the 25,000 mobile MAU allowance.

- [ ] **Step 2: Install**

Run: `cd apps/member && npx expo install @rnmapbox/maps`

- [ ] **Step 3: Wire the config plugin**

In `apps/member/app.json`, add to `expo.plugins`:

```json
[
  "@rnmapbox/maps",
  { "RNMapboxMapsDownloadToken": "sk.REPLACE_VIA_ENV" }
]
```

The download token must **not** be committed with a real value. Supply it at build time — locally via a shell env var, and on EAS as a secret (`eas secret:create --name RNMAPBOX_DOWNLOAD_TOKEN`). If the native build fails with a 401 from Mapbox's registry, this token is the cause; that failure mode is common enough to expect it once.

Note the app already sets `expo-build-properties` with `"useFrameworks": "static"` for Firebase — `@rnmapbox/maps` requires this too, so no change is needed, but do not remove it.

- [ ] **Step 4: Add the public token to the environment**

Add to `apps/member/.env.example`:

```
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_public_token_here
```

Set the real value in `apps/member/.env`. This follows the existing `EXPO_PUBLIC_*` convention (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_POLICY_VERSION`).

- [ ] **Step 5: Verify the config parses**

Run: `cd apps/member && npx expo config --type public > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add apps/member/package.json apps/member/app.json apps/member/.env.example ../../pnpm-lock.yaml
git commit -m "chore(member): add @rnmapbox/maps for roadside pin confirmation"
```

> **Native rebuild required**, and it must happen after both Task 7 and this task. Expo Go cannot run either module.

---

## Task 8: Location capture

**Files:**
- Create: `apps/member/src/features/roadside/location.ts`
- Test: `apps/member/src/features/roadside/location.test.ts`

**Interfaces:**
- Consumes: `expo-location` (Task 7), `EXPO_PUBLIC_MAPBOX_TOKEN` (Task 7A)
- Produces: `captureLocation(): Promise<LocationResult>` where `type LocationResult = { ok: true; lat: number; lng: number; address: string | null } | { ok: false; reason: "DENIED" | "UNAVAILABLE" }`
- Produces: `resolveAddress(lat, lng): Promise<string | null>` — the single vendor swap point (see "The honest limits of D-2")

- [ ] **Step 1: Write the failing test**

```ts
// apps/member/src/features/roadside/location.test.ts
import { captureLocation } from "./location";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const Location = require("expo-location");

// Mapbox Geocoding is a plain REST call (plan D-2), so it is mocked at `fetch`.
const mockGeocode = (body: unknown, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
};

describe("captureLocation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns coordinates and the Mapbox place name", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9214, longitude: 122.079 } });
    mockGeocode({ features: [{ place_name: "Governor Camins Ave, Zamboanga City, Zamboanga del Sur" }] });

    const r = await captureLocation();
    expect(r).toEqual({ ok: true, lat: 6.9214, lng: 122.079, address: "Governor Camins Ave, Zamboanga City, Zamboanga del Sur" });
  });

  it("asks Mapbox for the address of the coordinates it actually got", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9214, longitude: 122.079 } });
    mockGeocode({ features: [] });

    await captureLocation();
    // Mapbox takes lng,lat — in that order. Reversing them silently returns a
    // location in the wrong hemisphere, so this assertion is load-bearing.
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("/122.079,6.9214.json");
  });

  it("reports a denied permission so the screen can ask for a landmark instead", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    expect(await captureLocation()).toEqual({ ok: false, reason: "DENIED" });
  });

  // Geocoding is best-effort (plan D-2). Losing the address must never lose
  // the coordinates — those are what actually gets help to the member.
  it("keeps the coordinates when the network call throws", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("keeps the coordinates when Mapbox returns no features", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    mockGeocode({ features: [] });

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("keeps the coordinates when Mapbox rejects the token", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.9, longitude: 122.0 } });
    mockGeocode({ message: "Not Authorized" }, false);

    expect(await captureLocation()).toEqual({ ok: true, lat: 6.9, lng: 122.0, address: null });
  });

  it("reports an unavailable fix rather than throwing into the screen", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("no fix"));
    expect(await captureLocation()).toEqual({ ok: false, reason: "UNAVAILABLE" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/location.test.ts`
Expected: FAIL — cannot find module `./location`

- [ ] **Step 3: Write the implementation**

```ts
// apps/member/src/features/roadside/location.ts
import * as Location from "expo-location";

export type LocationResult =
  | { ok: true; lat: number; lng: number; address: string | null }
  | { ok: false; reason: "DENIED" | "UNAVAILABLE" };

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/**
 * The single vendor swap point for SI-7 (see plan D-2 and "The honest limits
 * of D-2"). If Mapbox's Zamboanga City coverage proves too thin, only this
 * function changes — the map tiles are a separate decision.
 */
export async function resolveAddress(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    // Mapbox orders coordinates lng,lat. Getting this backwards puts the
    // member in the wrong hemisphere without any error to notice.
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=1&language=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: Array<{ place_name?: string }> };
    return body.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

/**
 * FR-032 — where the member is.
 *
 * Every geocoding failure degrades to a null address rather than a thrown
 * error, because the coordinates alone are enough to dispatch on and the
 * landmark note covers the rest. Under D-3 the member can also drag the pin,
 * so a wrong-but-present address is recoverable too.
 */
export async function captureLocation(): Promise<LocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return { ok: false, reason: "DENIED" };

  let coords: { latitude: number; longitude: number };
  try {
    // Balanced, not Highest: a roadside fix needs to be fast and street-level,
    // and Highest can spin for many seconds hunting metres of precision.
    ({ coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  } catch {
    return { ok: false, reason: "UNAVAILABLE" };
  }

  const address = await resolveAddress(coords.latitude, coords.longitude);
  return { ok: true, lat: coords.latitude, lng: coords.longitude, address };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/location.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the Zamboanga coverage check**

Not a unit test — a one-off sanity check that the vendor decision holds, and the
cheapest possible way to find out that it does not. With a real token set, reverse
geocode 5–10 coordinates spread across the actual service area:

```bash
curl -s "https://api.mapbox.com/geocoding/v5/mapbox.places/122.079,6.9214.json?access_token=$MAPBOX_TOKEN&limit=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['features'][0]['place_name'])"
```

Expected: a recognisable street-level address, not just "Zamboanga City, Philippines".
If most results are city-level only, raise it — the fix is to point `resolveAddress()`
at Google while Mapbox keeps rendering the tiles, and that is a one-function change.

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/roadside/
git commit -m "feat(member): GPS capture with Mapbox reverse geocoding"
```

---

## Task 9: Member API client and status polling

**Files:**
- Create: `apps/member/src/features/roadside/roadsideApi.ts`
- Create: `apps/member/src/features/roadside/useRoadsideStatus.ts`
- Test: `apps/member/src/features/roadside/useRoadsideStatus.test.ts`

**Interfaces:**
- Consumes: `api` from `src/shared/api`; contracts types from Task 1
- Produces: `roadsideApi.eligibility()`, `.create(dto)`, `.active()`, `.byId(id)`; `useRoadsideStatus(initial): { request, error }`

- [ ] **Step 1: Write the API module**

```ts
// apps/member/src/features/roadside/roadsideApi.ts
import type { RoadsideEligibility, RoadsideRequestInput, RoadsideRequestView } from "@autocare/contracts";
import { api } from "../../shared/api";

export const roadsideApi = {
  eligibility: () => api.get<RoadsideEligibility>("/roadside/eligibility"),
  create: (dto: RoadsideRequestInput) => api.post<RoadsideRequestView>("/roadside/requests", dto),
  active: () => api.get<RoadsideRequestView | null>("/roadside/requests/active"),
  byId: (id: string) => api.get<RoadsideRequestView>(`/roadside/requests/${id}`),
};
```

- [ ] **Step 2: Write the failing hook test**

```ts
// apps/member/src/features/roadside/useRoadsideStatus.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useRoadsideStatus, ROADSIDE_POLL_MS } from "./useRoadsideStatus";
import { roadsideApi } from "./roadsideApi";

jest.mock("./roadsideApi", () => ({ roadsideApi: { byId: jest.fn() } }));

const base = {
  id: "rr-1", vehicleId: "veh-1", incidentType: "FLAT_TYRE" as const, lat: 6.9, lng: 122.0,
  address: null, landmarkNote: null, responderName: null, etaMinutes: null,
  createdAt: "2026-06-01T00:00:00.000Z", resolvedAt: null,
};

describe("useRoadsideStatus", () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
  afterEach(() => jest.useRealTimers());

  it("polls at the spec's 15 second fallback interval", async () => {
    (roadsideApi.byId as jest.Mock).mockResolvedValue({ ...base, status: "DISPATCHED" });
    const { result } = renderHook(() => useRoadsideStatus({ ...base, status: "REQUESTED" }));

    await act(async () => { jest.advanceTimersByTime(ROADSIDE_POLL_MS); });
    await waitFor(() => expect(result.current.request.status).toBe("DISPATCHED"));
    expect(ROADSIDE_POLL_MS).toBe(15_000);
  });

  // Polling a finished incident forever drains a battery the member may need.
  it("stops polling once the request resolves", async () => {
    (roadsideApi.byId as jest.Mock).mockResolvedValue({ ...base, status: "RESOLVED", resolvedAt: "2026-06-01T01:00:00.000Z" });
    renderHook(() => useRoadsideStatus({ ...base, status: "ON_SITE" }));

    await act(async () => { jest.advanceTimersByTime(ROADSIDE_POLL_MS); });
    const callsAfterResolve = (roadsideApi.byId as jest.Mock).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(ROADSIDE_POLL_MS * 3); });
    expect((roadsideApi.byId as jest.Mock).mock.calls.length).toBe(callsAfterResolve);
  });

  // A dropped signal is the normal case on a roadside. The last known status
  // must stay on screen rather than being replaced by an error.
  it("keeps the last known status when a poll fails", async () => {
    (roadsideApi.byId as jest.Mock).mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useRoadsideStatus({ ...base, status: "EN_ROUTE" }));

    await act(async () => { jest.advanceTimersByTime(ROADSIDE_POLL_MS); });
    expect(result.current.request.status).toBe("EN_ROUTE");
    expect(result.current.error).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/useRoadsideStatus.test.ts`
Expected: FAIL — cannot find module `./useRoadsideStatus`

- [ ] **Step 4: Write the implementation**

```ts
// apps/member/src/features/roadside/useRoadsideStatus.ts
import { useEffect, useRef, useState } from "react";
import type { RoadsideRequestView } from "@autocare/contracts";
import { roadsideApi } from "./roadsideApi";

/**
 * [[05 External Interface Requirements]] specifies Socket.IO with a 15 s polling
 * fallback. The socket transport does not exist in this repo yet (plan D-1), so
 * this is the fallback running as the primary. When the socket layer lands,
 * this hook is the only thing that changes.
 */
export const ROADSIDE_POLL_MS = 15_000;

const OPEN = new Set(["REQUESTED", "ACKNOWLEDGED", "DISPATCHED", "EN_ROUTE", "ON_SITE"]);

export function useRoadsideStatus(initial: RoadsideRequestView) {
  const [request, setRequest] = useState(initial);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!OPEN.has(request.status)) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }

    timer.current = setInterval(() => {
      roadsideApi
        .byId(request.id)
        // A failed poll leaves the last known status standing: on a roadside,
        // losing signal is expected and blanking the screen would read as the
        // request having been lost.
        .then((next) => { setRequest(next); setError(false); })
        .catch(() => setError(true));
    }, ROADSIDE_POLL_MS);

    return () => { if (timer.current) clearInterval(timer.current); };
  }, [request.id, request.status]);

  return { request, error };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/useRoadsideStatus.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/roadside/
git commit -m "feat(member): roadside API client and 15s status polling"
```

---

## Task 9A: The `IncidentMap` component

> Lettered, not renumbered — see the note on Task 7A.

Both roadside screens show the same map: M-26 needs it read-write so the member can
correct the pin, M-27 read-only so they can see where help is heading. One component,
one `editable` prop.

**Files:**
- Create: `apps/member/src/features/roadside/IncidentMap.tsx`
- Test: `apps/member/src/features/roadside/IncidentMap.test.tsx`

**Interfaces:**
- Consumes: `@rnmapbox/maps` (Task 7A)
- Produces: `<IncidentMap lat lng editable onMove />` where `onMove?: (lat: number, lng: number) => void`

- [ ] **Step 1: Write the failing test**

`@rnmapbox/maps` is a native module and renders nothing under jest, so mock it to
plain hosts and assert on the props passed down. The behaviour worth testing is the
contract, not Mapbox's rendering.

```tsx
// apps/member/src/features/roadside/IncidentMap.test.tsx
import { render } from "@testing-library/react-native";
import { IncidentMap } from "./IncidentMap";

jest.mock("@rnmapbox/maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Passthrough = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(View, { testID: name, ...props }, props.children as React.ReactNode);
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn() },
    MapView: Passthrough("map-view"),
    Camera: Passthrough("camera"),
    PointAnnotation: Passthrough("point-annotation"),
  };
});

describe("IncidentMap", () => {
  it("centres the camera on the incident", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9214} lng={122.079} editable={false} />);
    // Mapbox takes lng,lat — same trap as Task 8.
    expect(getByTestId("camera").props.centerCoordinate).toEqual([122.079, 6.9214]);
  });

  it("lets the member drag the pin when editable", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={jest.fn()} />);
    expect(getByTestId("point-annotation").props.draggable).toBe(true);
  });

  it("locks the pin when not editable", () => {
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable={false} />);
    expect(getByTestId("point-annotation").props.draggable).toBe(false);
  });

  it("reports the dragged position as lat,lng in our order, not Mapbox's", () => {
    const onMove = jest.fn();
    const { getByTestId } = render(<IncidentMap lat={6.9} lng={122.0} editable onMove={onMove} />);
    getByTestId("point-annotation").props.onDragEnd({ geometry: { coordinates: [122.5, 7.1] } });
    expect(onMove).toHaveBeenCalledWith(7.1, 122.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/IncidentMap.test.ts`
Expected: FAIL — cannot find module `./IncidentMap`

- [ ] **Step 3: Write the implementation**

Follow the design system: the pin uses the protected CRITICAL band fill (`theme.vhsBands.CRITICAL.fill`) for an
active incident, and the container takes `theme.radii.md` like every other card. Keep the map deliberately plain — no
traffic layer, no POI clutter. The member is stressed and looking for one thing.

```tsx
// apps/member/src/features/roadside/IncidentMap.tsx
import Mapbox, { Camera, MapView, PointAnnotation } from "@rnmapbox/maps";
import { View } from "react-native";
import { theme } from "../../theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

type Props = {
  lat: number;
  lng: number;
  editable: boolean;
  onMove?: (lat: number, lng: number) => void;
};

/**
 * FR-032 / D-3. When `editable`, the pin is the member's correction channel for
 * GPS drift — under a covered car park a raw fix can be tens of metres out, and
 * this is the difference between a dispatch and a phone call.
 */
export function IncidentMap({ lat, lng, editable, onMove }: Props) {
  return (
    <View style={{ height: 220, borderRadius: theme.radii.md, overflow: "hidden" }}>
      <MapView style={{ flex: 1 }} scaleBarEnabled={false} logoEnabled>
        <Camera centerCoordinate={[lng, lat]} zoomLevel={16} animationDuration={0} />
        <PointAnnotation
          id="incident"
          coordinate={[lng, lat]}
          draggable={editable}
          onDragEnd={(f: { geometry: { coordinates: number[] } }) => {
            const [dLng, dLat] = f.geometry.coordinates;
            onMove?.(dLat, dLng);
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: theme.vhsBands.CRITICAL.fill,
              borderWidth: 3,
              borderColor: "#FFFFFF",
            }}
          />
        </PointAnnotation>
      </MapView>
    </View>
  );
}
```

> `logoEnabled` stays **on**. The Mapbox terms require attribution; turning it off is a
> licence violation, not a style choice.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/IncidentMap.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/roadside/IncidentMap.tsx apps/member/src/features/roadside/IncidentMap.test.tsx
git commit -m "feat(member): incident map with a draggable pin"
```

---

## Task 10: M-26 request screen

**Files:**
- Create: `apps/member/src/features/roadside/RoadsideRequestScreen.tsx`
- Test: `apps/member/src/features/roadside/RoadsideRequestScreen.test.tsx`
- Modify: `apps/member/src/components/Icon.tsx`

**Interfaces:**
- Consumes: `incidentTypes` (Task 1), `LocationResult` (Task 8), `IncidentMap` (Task 9A)
- Produces: `<RoadsideRequestScreen eligibility location onRetryLocation onSubmit submitting error hotline />`

> **D-3 addendum to this task.** The code below predates the map decision. Alongside it:
> - Render `<IncidentMap editable lat lng onMove />` above the location summary when
>   `location.ok` is true.
> - Hold the pin position in screen state seeded from `location`, and submit **that**,
>   not the raw GPS fix — the member's confirmation is what counts (D-3).
> - When the member drags the pin, re-run `resolveAddress()` (Task 8) for the new
>   position so the displayed address stays truthful. Debounce it; do not call per frame.
> - Add a test: dragging the pin then submitting sends the dragged coordinates.
> - Keep every existing no-GPS path exactly as written. A denied permission or a failed
>   fix means **no map at all** and the landmark note carries the request — that path is
>   FR-032's mandate and the map must not become a hard dependency of submitting.

- [ ] **Step 1: Add the icons this screen needs**

In `apps/member/src/components/Icon.tsx`, add to the lucide import list: `CircleAlert, Crosshair, PhoneCall`. Add to `GLYPHS`:

```ts
  "circle-alert": CircleAlert,
  "crosshair": Crosshair,
  "phone-call": PhoneCall,
```

- [ ] **Step 2: Write the failing test**

```tsx
// apps/member/src/features/roadside/RoadsideRequestScreen.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { RoadsideRequestScreen } from "./RoadsideRequestScreen";

const eligible = { eligible: true };
const located = { ok: true as const, lat: 6.9214, lng: 122.079, address: "Governor Camins Ave, Zamboanga City" };
const props = () => ({
  eligibility: eligible,
  location: located,
  onRetryLocation: jest.fn(),
  onSubmit: jest.fn(),
  onCallHotline: jest.fn(),
  submitting: false,
  error: null as string | null,
});

describe("RoadsideRequestScreen (M-26)", () => {
  it("offers every incident type the spec lists", () => {
    const { getByText } = render(<RoadsideRequestScreen {...props()} />);
    for (const label of ["Flat tyre", "Dead battery", "Out of fuel", "Overheating", "Won't start", "Accident", "Other"]) {
      getByText(label);
    }
  });

  it("cannot send until an incident type is chosen", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} />);
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).not.toHaveBeenCalled();
  });

  it("sends the incident, coordinates and landmark together", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} />);
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.changeText(getByTestId("roadside-landmark"), "Beside the blue gate");
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).toHaveBeenCalledWith({
      incidentType: "FLAT_TYRE", lat: 6.9214, lng: 122.079,
      address: "Governor Camins Ave, Zamboanga City", landmarkNote: "Beside the blue gate",
    });
  });

  // FR-035 — a refusal has to name the date and never read as a punishment.
  it("explains a waiting period instead of just disabling the button", () => {
    const { getByText, queryByTestId } = render(
      <RoadsideRequestScreen {...props()} eligibility={{ eligible: false, reason: "Roadside assistance opens 30 days after your first payment. You're covered from 2026-07-01." }} />,
    );
    getByText(/opens 30 days after your first payment/);
    expect(queryByTestId("roadside-submit")).toBeNull();
  });

  // FR-040 — the fallback must be reachable even when the app path is blocked.
  it("offers the hotline whether or not the member is eligible", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} eligibility={{ eligible: false, reason: "Not yet." }} />);
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(p.onCallHotline).toHaveBeenCalled();
  });

  // FR-032 — denying location must not dead-end the request.
  it("asks for a landmark and still allows sending when location is denied", () => {
    const p = props();
    const { getByText, getByTestId } = render(
      <RoadsideRequestScreen {...p} location={{ ok: false, reason: "DENIED" }} />,
    );
    getByText(/tell us where you are/i);
    fireEvent.press(getByTestId("incident-ACCIDENT"));
    fireEvent.changeText(getByTestId("roadside-landmark"), "KM 12 near the covered court");
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ incidentType: "ACCIDENT", landmarkNote: "KM 12 near the covered court" }));
  });

  it("will not send without location or a landmark", () => {
    const p = props();
    const { getByTestId } = render(<RoadsideRequestScreen {...p} location={{ ok: false, reason: "DENIED" }} />);
    fireEvent.press(getByTestId("incident-OTHER"));
    fireEvent.press(getByTestId("roadside-submit"));
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideRequestScreen.test.tsx`
Expected: FAIL — cannot find module `./RoadsideRequestScreen`

- [ ] **Step 4: Write the implementation**

```tsx
// apps/member/src/features/roadside/RoadsideRequestScreen.tsx
import { useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import type { IncidentType, RoadsideEligibility } from "@autocare/contracts";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import type { LocationResult } from "./location";

/** FR-033, in the member's words rather than the enum's. */
const INCIDENTS: { type: IncidentType; label: string }[] = [
  { type: "FLAT_TYRE", label: "Flat tyre" },
  { type: "DEAD_BATTERY", label: "Dead battery" },
  { type: "OUT_OF_FUEL", label: "Out of fuel" },
  { type: "OVERHEATING", label: "Overheating" },
  { type: "WILL_NOT_START", label: "Won't start" },
  { type: "ACCIDENT", label: "Accident" },
  { type: "OTHER", label: "Other" },
];

export type RoadsideSubmit = {
  incidentType: IncidentType;
  lat: number;
  lng: number;
  address?: string;
  landmarkNote?: string;
};

/**
 * M-26 — raise an emergency.
 *
 * The screen is built so that no single failure blocks the request: a denied
 * permission leaves the landmark field, a failed geocode leaves the
 * coordinates, and an ineligible plan still leaves the hotline (FR-040).
 */
export function RoadsideRequestScreen({
  eligibility, location, onRetryLocation, onSubmit, onCallHotline, submitting, error,
}: {
  eligibility: RoadsideEligibility;
  location: LocationResult | null;
  onRetryLocation: () => void;
  onSubmit: (s: RoadsideSubmit) => void;
  onCallHotline: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const t = theme;
  const [incident, setIncident] = useState<IncidentType | null>(null);
  const [landmark, setLandmark] = useState("");

  const hasFix = location?.ok === true;
  // Without coordinates a landmark is the only thing that can route help.
  const canSend = !!incident && (hasFix || landmark.trim().length > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      testID="roadside-request-screen"
    >
      <View style={{ gap: 4 }}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>Roadside assistance</Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          Tell us what happened and we'll send help to you.
        </Text>
      </View>

      {!eligibility.eligible ? (
        <Card accent={t.colors.danger} style={{ gap: t.spacing.sm }}>
          <Text style={[t.text("body"), { color: t.colors.ink }]}>{eligibility.reason}</Text>
          {eligibility.paidAlternativeCentavos != null ? (
            <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
              A one-off call-out costs ₱{(eligibility.paidAlternativeCentavos / 100).toLocaleString("en-PH")}.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>What happened?</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm }}>
          {INCIDENTS.map((i) => {
            const selected = incident === i.type;
            return (
              <Pressable
                key={i.type}
                testID={`incident-${i.type}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setIncident(i.type)}
                style={{
                  minHeight: t.minTarget, justifyContent: "center",
                  paddingHorizontal: t.spacing.md,
                  borderRadius: t.radii.pill,
                  borderWidth: selected ? t.borders.control : t.borders.hairline,
                  borderColor: selected ? t.colors.primary : t.colors.lineSoft,
                  backgroundColor: selected ? t.colors.primarySoft : t.colors.surface,
                }}
              >
                <Text style={[t.text("label", 600), { color: selected ? t.colors.primary : t.colors.ink }]}>{i.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("h2"), { color: t.colors.ink }]}>Where are you?</Text>
        {hasFix ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Icon name="map-pin" size={20} color={t.colors.primary} />
            <Text style={[t.text("body"), { color: t.colors.ink, flex: 1 }]}>
              {location.address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
            </Text>
          </Card>
        ) : (
          <Card accent={t.colors.danger} style={{ gap: t.spacing.sm }}>
            <Text style={[t.text("body"), { color: t.colors.ink }]}>
              We couldn't get your location — tell us where you are and we'll find you.
            </Text>
            <Button variant="secondary" icon="crosshair" testID="roadside-retry-location" onPress={onRetryLocation}>
              Try location again
            </Button>
          </Card>
        )}

        <TextInput
          testID="roadside-landmark"
          value={landmark}
          onChangeText={setLandmark}
          placeholder="Nearest landmark, e.g. beside the blue gate"
          placeholderTextColor={t.colors.inkFaint}
          multiline
          style={[
            t.text("body"),
            {
              minHeight: t.minTarget, color: t.colors.ink,
              backgroundColor: t.colors.surface,
              borderWidth: t.borders.hairline, borderColor: t.colors.lineSoft,
              borderRadius: t.radii.sm, padding: t.spacing.md,
            },
          ]}
        />
      </View>

      {error ? (
        <Text testID="roadside-error" style={[t.text("body"), { color: t.colors.danger }]}>{error}</Text>
      ) : null}

      {eligibility.eligible ? (
        <Button
          block
          variant="danger"
          testID="roadside-submit"
          disabled={!canSend || submitting}
          onPress={() => {
            if (!canSend || !incident) return;
            onSubmit({
              incidentType: incident,
              lat: hasFix ? location.lat : 0,
              lng: hasFix ? location.lng : 0,
              address: hasFix ? (location.address ?? undefined) : undefined,
              landmarkNote: landmark.trim() || undefined,
            });
          }}
        >
          {submitting ? "Sending…" : "Request assistance"}
        </Button>
      ) : null}

      {/* FR-040 — always reachable, eligible or not. */}
      <Button block variant="secondary" icon="phone-call" testID="roadside-hotline" onPress={onCallHotline}>
        Call the hotline instead
      </Button>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideRequestScreen.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/roadside/ apps/member/src/components/Icon.tsx
git commit -m "feat(member): M-26 roadside request screen"
```

---

## Task 11: M-27 status screen

**Files:**
- Create: `apps/member/src/features/roadside/RoadsideStatusScreen.tsx`
- Test: `apps/member/src/features/roadside/RoadsideStatusScreen.test.tsx`

**Interfaces:**
- Consumes: `RoadsideRequestView` (Task 1), `roadsideStatuses` order (Task 1), `IncidentMap` (Task 9A)
- Produces: `<RoadsideStatusScreen request stale onCallHotline onOpenInMaps />`

> **D-3 addendum to this task.** Render `<IncidentMap editable={false} lat={request.lat} lng={request.lng} />`
> near the top, under the status timeline. Read-only: once the request is in, the
> location is settled and a draggable pin would imply otherwise. `onOpenInMaps` stays —
> it is still the fastest route to turn-by-turn directions in the member's own app.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/member/src/features/roadside/RoadsideStatusScreen.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { RoadsideStatusScreen } from "./RoadsideStatusScreen";

const req = (over = {}) => ({
  id: "rr-1", vehicleId: "veh-1", incidentType: "FLAT_TYRE" as const,
  lat: 6.9214, lng: 122.079, address: "Governor Camins Ave", landmarkNote: null,
  status: "EN_ROUTE" as const, responderName: "J. Cruz", etaMinutes: 20,
  createdAt: "2026-06-01T00:00:00.000Z", resolvedAt: null, ...over,
});

describe("RoadsideStatusScreen (M-27)", () => {
  it("shows every step of the timeline", () => {
    const { getByText } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    for (const step of ["Requested", "Acknowledged", "Dispatched", "On the way", "On site", "Resolved"]) {
      getByText(step);
    }
  });

  it("marks steps already passed as done and names the current one", () => {
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    expect(getByTestId("step-REQUESTED").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("step-EN_ROUTE").props.accessibilityState.selected).toBe(true);
    expect(getByTestId("step-ON_SITE").props.accessibilityState.selected).toBe(false);
  });

  it("names the responder and the ETA when one has been assigned", () => {
    const { getByText } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    getByText("J. Cruz");
    getByText(/20 min/);
  });

  // A stale poll must be visible, not silent — the member is deciding whether
  // to keep waiting or call.
  it("says when the status may be out of date", () => {
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    expect(getByTestId("roadside-stale")).toBeTruthy();
  });

  it("offers the hotline throughout (FR-040)", () => {
    const onCallHotline = jest.fn();
    const { getByTestId } = render(
      <RoadsideStatusScreen request={req()} stale={false} onCallHotline={onCallHotline} onOpenInMaps={jest.fn()} />,
    );
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(onCallHotline).toHaveBeenCalled();
  });

  it("closes the loop when resolved", () => {
    const { getByText } = render(
      <RoadsideStatusScreen request={req({ status: "RESOLVED", resolvedAt: "2026-06-01T01:00:00.000Z" })} stale={false} onCallHotline={jest.fn()} onOpenInMaps={jest.fn()} />,
    );
    getByText(/sorted/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideStatusScreen.test.tsx`
Expected: FAIL — cannot find module `./RoadsideStatusScreen`

- [ ] **Step 3: Write the implementation**

```tsx
// apps/member/src/features/roadside/RoadsideStatusScreen.tsx
import { ScrollView, Text, View } from "react-native";
import { roadsideStatuses, type RoadsideRequestView, type RoadsideStatus } from "@autocare/contracts";
import { theme } from "../../theme";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";

const STEP_LABEL: Record<RoadsideStatus, string> = {
  REQUESTED: "Requested",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  EN_ROUTE: "On the way",
  ON_SITE: "On site",
  RESOLVED: "Resolved",
};

/**
 * M-27 — the wait, made legible.
 *
 * Status colours are semantic (success / muted), never band tokens: a band
 * colour on this screen would read as a vehicle score (design principle 1).
 */
export function RoadsideStatusScreen({
  request, stale, onCallHotline, onOpenInMaps,
}: {
  request: RoadsideRequestView;
  /** True when the last poll failed — the member is looking at old data. */
  stale: boolean;
  onCallHotline: () => void;
  onOpenInMaps: () => void;
}) {
  const t = theme;
  const currentIndex = roadsideStatuses.indexOf(request.status);
  const resolved = request.status === "RESOLVED";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.chassis }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
      testID="roadside-status-screen"
    >
      <View style={{ gap: 4 }}>
        <Text style={[t.text("h1"), { color: t.colors.ink }]}>
          {resolved ? "You're sorted" : "Help is coming"}
        </Text>
        <Text style={[t.text("body"), { color: t.colors.inkMuted }]}>
          {resolved
            ? "This call-out is closed. Thanks for your patience."
            : "We'll keep this updated as your responder moves."}
        </Text>
      </View>

      {stale ? (
        <Card testID="roadside-stale" accent={t.colors.danger}>
          <Text style={[t.text("label"), { color: t.colors.ink }]}>
            Showing the last update we received — we'll refresh when you're back online.
          </Text>
        </Card>
      ) : null}

      {request.responderName ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}>
          <Icon name="wrench" size={24} color={t.colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[t.text("h2"), { color: t.colors.ink }]}>{request.responderName}</Text>
            {request.etaMinutes != null ? (
              <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>
                About {request.etaMinutes} min away
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card style={{ gap: t.spacing.md }}>
        {roadsideStatuses.map((s, i) => {
          const done = i <= currentIndex;
          return (
            <View
              key={s}
              testID={`step-${s}`}
              accessibilityState={{ selected: done }}
              style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.md }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: t.radii.pill,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: done ? t.colors.success : t.colors.surfaceSunken,
                }}
              >
                {done ? <Icon name="check" size={14} color={t.colors.onPrimary} /> : null}
              </View>
              <Text style={[t.text("body"), { color: done ? t.colors.ink : t.colors.inkFaint }]}>
                {STEP_LABEL[s]}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card style={{ gap: t.spacing.sm }}>
        <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>Where we're coming to</Text>
        <Text style={[t.text("body"), { color: t.colors.ink }]}>
          {request.address ?? `${request.lat.toFixed(5)}, ${request.lng.toFixed(5)}`}
        </Text>
        {request.landmarkNote ? (
          <Text style={[t.text("label"), { color: t.colors.inkMuted }]}>{request.landmarkNote}</Text>
        ) : null}
        <Button variant="secondary" icon="map-pin" testID="roadside-open-maps" onPress={onOpenInMaps}>
          Open in maps
        </Button>
      </Card>

      <Button block variant="secondary" icon="phone-call" testID="roadside-hotline" onPress={onCallHotline}>
        Call the hotline
      </Button>
    </ScrollView>
  );
}
```

Add `Check` to the lucide import in `Icon.tsx` and `"check": Check,` to `GLYPHS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideStatusScreen.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/roadside/ apps/member/src/components/Icon.tsx
git commit -m "feat(member): M-27 roadside status timeline"
```

---

## Task 12: Wire the flow and fix the dead-end button

**Files:**
- Create: `apps/member/src/features/roadside/RoadsideContainer.tsx`
- Modify: `apps/member/src/app/RootNavigator.tsx`
- Test: `apps/member/src/features/roadside/RoadsideContainer.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 8–11
- Produces: a `Roadside` route; `onRoadside` on Home navigates to it

- [ ] **Step 1: Write the failing test**

```tsx
// apps/member/src/features/roadside/RoadsideContainer.test.tsx
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { RoadsideContainer } from "./RoadsideContainer";
import { roadsideApi } from "./roadsideApi";
import { captureLocation } from "./location";

jest.mock("./roadsideApi", () => ({
  roadsideApi: { eligibility: jest.fn(), create: jest.fn(), active: jest.fn(), byId: jest.fn() },
}));
jest.mock("./location", () => ({ captureLocation: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
const Linking = require("expo-linking");

const vehicleId = "3f1a0c9e-0000-4000-8000-000000000001";

describe("RoadsideContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (captureLocation as jest.Mock).mockResolvedValue({ ok: true, lat: 6.9, lng: 122.0, address: "Somewhere" });
    (roadsideApi.active as jest.Mock).mockResolvedValue(null);
    (roadsideApi.eligibility as jest.Mock).mockResolvedValue({ eligible: true });
  });

  it("shows the request screen when nothing is open", async () => {
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
  });

  // Coming back to the app mid-incident must land on the status, not on a
  // form that would open a second request.
  it("goes straight to the status screen when an incident is already live", async () => {
    (roadsideApi.active as jest.Mock).mockResolvedValue({
      id: "rr-1", vehicleId, incidentType: "FLAT_TYRE", lat: 6.9, lng: 122.0,
      address: null, landmarkNote: null, status: "EN_ROUTE", responderName: "J. Cruz",
      etaMinutes: 15, createdAt: "2026-06-01T00:00:00.000Z", resolvedAt: null,
    });
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-status-screen"));
  });

  it("moves to the status screen after a successful request", async () => {
    (roadsideApi.create as jest.Mock).mockResolvedValue({
      id: "rr-2", vehicleId, incidentType: "FLAT_TYRE", lat: 6.9, lng: 122.0,
      address: null, landmarkNote: null, status: "REQUESTED", responderName: null,
      etaMinutes: null, createdAt: "2026-06-01T00:00:00.000Z", resolvedAt: null,
    });
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.press(getByTestId("roadside-submit"));
    await waitFor(() => getByTestId("roadside-status-screen"));
  });

  it("surfaces a refusal instead of silently failing", async () => {
    (roadsideApi.create as jest.Mock).mockRejectedValue(Object.assign(new Error("Not covered yet"), { code: "ROADSIDE_NOT_ELIGIBLE" }));
    const { getByTestId, getByText } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("incident-FLAT_TYRE"));
    fireEvent.press(getByTestId("roadside-submit"));
    await waitFor(() => getByText("Not covered yet"));
  });

  it("dials the hotline through the OS (FR-040)", async () => {
    const { getByTestId } = render(<RoadsideContainer vehicleId={vehicleId} />);
    await waitFor(() => getByTestId("roadside-request-screen"));
    fireEvent.press(getByTestId("roadside-hotline"));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^tel:/));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideContainer.test.tsx`
Expected: FAIL — cannot find module `./RoadsideContainer`

- [ ] **Step 3: Write the implementation**

```tsx
// apps/member/src/features/roadside/RoadsideContainer.tsx
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import type { RoadsideEligibility, RoadsideRequestView } from "@autocare/contracts";
import { theme } from "../../theme";
import { roadsideApi } from "./roadsideApi";
import { captureLocation, type LocationResult } from "./location";
import { RoadsideRequestScreen, type RoadsideSubmit } from "./RoadsideRequestScreen";
import { RoadsideStatusScreen } from "./RoadsideStatusScreen";
import { useRoadsideStatus } from "./useRoadsideStatus";

/** FR-040 fallback. Replace with the real dispatch line before launch. */
export const ROADSIDE_HOTLINE = "+6329110000";

function StatusView({ initial, onCallHotline }: { initial: RoadsideRequestView; onCallHotline: () => void }) {
  const { request, error } = useRoadsideStatus(initial);
  return (
    <RoadsideStatusScreen
      request={request}
      stale={error}
      onCallHotline={onCallHotline}
      onOpenInMaps={() => Linking.openURL(`https://maps.google.com/?q=${request.lat},${request.lng}`)}
    />
  );
}

export function RoadsideContainer({ vehicleId }: { vehicleId: string }) {
  const [eligibility, setEligibility] = useState<RoadsideEligibility | null>(null);
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [live, setLive] = useState<RoadsideRequestView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callHotline = useCallback(() => { void Linking.openURL(`tel:${ROADSIDE_HOTLINE}`); }, []);

  const getLocation = useCallback(() => { void captureLocation().then(setLocation).catch(() => setLocation({ ok: false, reason: "UNAVAILABLE" })); }, []);

  useEffect(() => {
    // An open incident wins: returning to the app mid-call-out must not show
    // a form that could open a second one.
    void roadsideApi.active().then(setLive).catch(() => setLive(null));
    void roadsideApi.eligibility().then(setEligibility).catch(() => setEligibility({ eligible: false, reason: "We couldn't check your cover. Call the hotline and we'll sort it." }));
    getLocation();
  }, [getLocation]);

  async function submit(s: RoadsideSubmit) {
    setSubmitting(true);
    setError(null);
    try {
      setLive(await roadsideApi.create({ vehicleId, ...s }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't send that. Call the hotline and we'll sort it.");
    } finally {
      setSubmitting(false);
    }
  }

  if (live) return <StatusView initial={live} onCallHotline={callHotline} />;

  if (!eligibility) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.chassis, alignItems: "center", justifyContent: "center" }}>
        <Text style={[theme.text("body"), { color: theme.colors.inkMuted }]}>Checking your cover…</Text>
      </View>
    );
  }

  return (
    <RoadsideRequestScreen
      eligibility={eligibility}
      location={location}
      onRetryLocation={getLocation}
      onSubmit={submit}
      onCallHotline={callHotline}
      submitting={submitting}
      error={error}
    />
  );
}
```

- [ ] **Step 4: Register the route and fix the dead-end button**

In `apps/member/src/app/RootNavigator.tsx`:

Import the container near the other feature imports:

```tsx
import { RoadsideContainer } from "../features/roadside/RoadsideContainer";
```

Add a screen beside the other stack screens (around line 942):

```tsx
      <Stack.Screen name="Roadside">
        {({ route }: any) => <RoadsideContainer vehicleId={route.params?.vehicleId} />}
      </Stack.Screen>
```

Replace the dead-end handler (line 310) — it currently sends an emergency tap to the Bookings tab:

```tsx
      onRoadside={primary ? () => parent?.navigate("Roadside", { vehicleId: primary.id }) : undefined}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/roadside/RoadsideContainer.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Run the whole member suite and typecheck**

Run: `cd apps/member && npx tsc --noEmit && npx jest`
Expected: typecheck clean, all suites pass

- [ ] **Step 7: Commit**

```bash
git add apps/member/src/features/roadside/ apps/member/src/app/RootNavigator.tsx
git commit -m "feat(member): wire roadside flow and replace the dead-end Request button"
```

---

## Task 13: Show real call-out balance on Home

**Files:**
- Modify: `apps/member/src/app/RootNavigator.tsx`
- Test: `apps/member/src/features/home/HomeScreen.test.tsx` (append)

**Interfaces:**
- Consumes: `EntitlementSummary` from the existing entitlements endpoint
- Produces: `roadsideCallouts` actually supplied to `HomeScreen`

`HomeScreen` already accepts `roadsideCallouts` and renders "N call-outs left this cycle", but no call site passes it, so it always falls back to the generic line.

- [ ] **Step 1: Write the failing test**

Append to `apps/member/src/features/home/HomeScreen.test.tsx`:

```tsx
describe("HomeScreen roadside balance", () => {
  const base = {
    firstName: "Rielle", vehicle: null, onAddVehicle: jest.fn(),
    onUpdateOdometer: jest.fn(), onRoadside: jest.fn(),
  };

  it("names the remaining call-outs when the balance is known", () => {
    const { getByText } = render(<HomeScreen {...base} roadsideCallouts={2} />);
    getByText("2 call-outs left this cycle");
  });

  it("falls back to the generic line when the balance is unknown", () => {
    const { getByText } = render(<HomeScreen {...base} roadsideCallouts={null} />);
    getByText("24/7 emergency help");
  });

  // Out of cover is not the same as no cover: the card must still be reachable
  // so the member can see the paid alternative (FR-035).
  it("still offers roadside at zero remaining", () => {
    const { getByTestId, getByText } = render(<HomeScreen {...base} roadsideCallouts={0} />);
    getByText("0 call-outs left this cycle");
    expect(getByTestId("quick-roadside")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/member && npx jest src/features/home/HomeScreen.test.tsx -t "roadside balance"`
Expected: FAIL — the balance tests fail because nothing renders the count

- [ ] **Step 3: Supply the value**

In `RootNavigator.tsx`, inside the component that renders `HomeScreen`, derive the balance from the entitlements already fetched for the account screen and pass it:

```tsx
      roadsideCallouts={
        entitlements?.find((e) => e.entitlementType === "ROADSIDE")?.remaining ?? null
      }
```

If `entitlements` is not already in scope in that component, load it the same way the account screen does and default to `null` until it arrives — `null` is the honest "not known yet", and the card already handles it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/member && npx jest src/features/home/HomeScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/app/RootNavigator.tsx apps/member/src/features/home/HomeScreen.test.tsx
git commit -m "feat(member): show real roadside call-out balance on Home"
```

---

## Task 13A: FR-039 route distance via Mapbox Directions

> Lettered, not renumbered — see the note on Task 7A. This task only became
> cheap once D-3 settled on a vendor; before that, "distance travelled" was
> going to be a number the advisor typed in by hand.

FR-039 asks for "distance travelled" at resolution. The workshop's own coordinates
are the origin, the incident location the destination, and Mapbox Directions turns
that into a driving distance — the number that actually matters for FR-099 cost
reporting, and materially different from a straight line on a coastal road network.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/modules/roadside/route-distance.ts`
- Test: `apps/api/src/modules/roadside/route-distance.spec.ts`
- Modify: `apps/api/src/modules/roadside/roadside.service.ts` (resolve path)
- Modify: `packages/contracts/src/roadside.ts`

**Interfaces:**
- Consumes: `MAPBOX_TOKEN` (server env — **not** the `EXPO_PUBLIC_` one)
- Produces: `routeDistanceKm(from, to): Promise<number | null>`; `RoadsideRequest.distanceKm`

- [ ] **Step 1: Add the column**

In `schema.prisma`, on `model RoadsideRequest`, beside `costCentavos`:

```prisma
  distanceKm         Float?         @map("distance_km")
```

Nullable, because the Directions call is best-effort exactly like geocoding — a
resolution must never fail because a maps API was down.

Run: `cd apps/api && npx prisma migrate dev --name roadside-distance`

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/src/modules/roadside/route-distance.spec.ts
import { routeDistanceKm } from "./route-distance";

describe("routeDistanceKm", () => {
  const from = { lat: 6.9214, lng: 122.0790 };
  const to = { lat: 6.9100, lng: 122.0700 };

  afterEach(() => jest.restoreAllMocks());

  it("converts Mapbox metres to kilometres", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ routes: [{ distance: 4321 }] }),
    }) as unknown as typeof fetch;

    expect(await routeDistanceKm(from, to)).toBeCloseTo(4.321, 3);
  });

  it("returns null when Mapbox finds no route rather than failing the resolution", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ routes: [] }),
    }) as unknown as typeof fetch;

    expect(await routeDistanceKm(from, to)).toBeNull();
  });

  it("returns null when the call throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect(await routeDistanceKm(from, to)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/api && npx jest src/modules/roadside/route-distance.spec.ts`
Expected: FAIL — cannot find module `./route-distance`

- [ ] **Step 4: Write the implementation**

```ts
// apps/api/src/modules/roadside/route-distance.ts
type Point = { lat: number; lng: number };

/**
 * FR-039 — driving distance from the workshop to the incident.
 *
 * Best-effort by design: every failure returns null, because a maps API being
 * unreachable must never block an advisor from closing out a resolved call.
 * The column is nullable for the same reason.
 */
export async function routeDistanceKm(from: Point, to: Point): Promise<number | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) return null;
  try {
    // lng,lat ordering again — see Task 8.
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?access_token=${token}&overview=false&alternatives=false`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { routes?: Array<{ distance?: number }> };
    const metres = body.routes?.[0]?.distance;
    return typeof metres === "number" ? metres / 1000 : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Call it from `resolve()`**

In `roadside.service.ts`, in the resolve path, compute the distance before the
update and persist it alongside `costCentavos`. The workshop origin comes from
config, not a literal — reuse whatever the scheduling module already uses for the
workshop's location, or add `WORKSHOP_LAT` / `WORKSHOP_LNG` to the API env if no
such value exists yet.

Add `distanceKm: z.number().nullable().optional()` to the resolve output contract
in `packages/contracts/src/roadside.ts` and surface it on the advisor view.

- [ ] **Step 6: Run the API suite**

Run: `cd apps/api && npx tsc --noEmit && npx jest src/modules/roadside`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma apps/api/src/modules/roadside packages/contracts/src/roadside.ts
git commit -m "feat(api): FR-039 route distance from Mapbox Directions"
```

---

## Task 14: Update the traceability matrix

**Files:**
- Modify: `AutoCare+ Docs/99 Meta/15 Requirements Traceability Matrix.md`
- Modify: `AutoCare+ Docs/01 SRS/03 Functional Requirements.md`

- [ ] **Step 1: Flip the status markers**

In `03 Functional Requirements.md`, change the status cell from 🔴 to 🟢 for FR-031, FR-032, FR-033, FR-034, FR-035, FR-037, FR-038, FR-039, FR-040.

Leave **FR-036 at 🔴** and add this note beneath the table:

> FR-036 is partially met: new requests appear on the advisor dispatch board (`GET /roadside/board`), but there is no push transport yet, so the 30-second guarantee is not enforced. Tracked with the notifications project.

- [ ] **Step 2: Record the transport deviation**

In `15 Requirements Traceability Matrix.md`, on the FR-038 row, change the interface cell from `WS roadside.status` to:

```
polling `GET /roadside/requests/:id` @15s (WS deferred)
```

- [ ] **Step 3: Commit**

```bash
git add "AutoCare+ Docs/99 Meta/15 Requirements Traceability Matrix.md" "AutoCare+ Docs/01 SRS/03 Functional Requirements.md"
git commit -m "docs: mark roadside requirements delivered, note FR-036 and FR-038 deviations"
```

---

## Not covered by this plan

These need their own projects. None blocks the member path above.

| Gap | Requirement | Why separate |
|---|---|---|
| Socket.IO transport | FR-038 (real-time) | Cross-cutting — serves trips and work orders too. Polling is the spec's own fallback. |
| FCM push to advisors | FR-036 (30 s notify) | Needs a notifications module and a device-token table; neither exists. |
| Staff console roadside board UI | FR-037 | `apps/web` screens. API is ready (`GET /roadside/board`). |
| Roadside cost report | FR-099 | `cost_centavos` is captured; the admin report is a reporting task. |
| Paid alternative pricing | FR-035 | `paidAlternativeCentavos` is in the contract but always null until overage pricing is decided — the same open decision as plan tier pricing. |
| Service-zone check | `OUT_OF_SERVICE_ZONE` | Still not built, but **no longer blocked**: open decision D-7 in [[13 Constraints and Risks]] already defaults to a 10 km radius with a ₱30/km surcharge beyond it, and a radius test against the workshop coordinates needs no polygon and no new vendor call. Confirm D-7, then it is a small task. |

---

## Verification

After Task 14, run the full suite from the repo root:

```bash
(cd packages/contracts && npx vitest run)
(cd packages/design-tokens && npx vitest run)
(cd apps/api && npx tsc --noEmit && npx jest)
(cd apps/member && npx tsc --noEmit && npx jest)
(cd apps/web && npx tsc --noEmit && npx vitest run)
(cd apps/field && npx jest)
```

All green, with the roadside suites present: `roadside.test.ts` (contracts), `roadside.service.spec.ts` + `route-distance.spec.ts` + `roadside.e2e-spec.ts` (api), and the six member suites under `src/features/roadside/` (including `IncidentMap.test.tsx`).

**Cannot be verified headless — owed on-device (D-3 makes this non-optional):**

The map is a native module, so jest proves the contract and nothing about whether a
map actually draws. After a fresh dev-client build, on a real device:

1. The map renders tiles at all — a blank grey box means the public token is missing or unscoped.
2. The pin drags, and the address text updates to match the dragged position.
3. Submitting after a drag sends the **dragged** coordinates, not the original GPS fix.
4. Denying location permission still reaches a submittable form with the landmark note.
5. The Mapbox attribution/logo is visible (licence requirement, see Task 9A).

Also confirm in the Mapbox dashboard, after testing, that MAU and Geocoding usage
look sane. A runaway number this early means something is calling the API in a loop.
