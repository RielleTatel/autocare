---
title: 05 External Interface Requirements
type: srs-section
project: AutoCare+
section: "5"
version: 1.0
status: draft
tags:
  - srs
  - interfaces
---

# 5. External Interface Requirements

> [!info] Navigation
> ⬅️ [[04 Non-Functional Requirements]] · ➡️ [[06 Use Cases]]

---

## 5.1 User interfaces

Three distinct clients, all sharing one design token set.

| Client | Platform | Primary users | Design priority |
|---|---|---|---|
| **Member App** | React Native (iOS + Android) | Member, Fleet Manager | Polish and trust — this is the customer-facing product |
| **Field App** | React Native (Android phones/tablets) | Mechanic, Driver | Speed, glove-friendly targets, offline resilience |
| **Web Application** | **Next.js** (App Router) | Service Advisor, Administrator, and 🌐 public certificate viewers | Data density, keyboard-driven workflows, bulk actions, exports; server-rendered public pages |

> [!note] Why the Service Advisor is on web, not the field app
> The advisor works at a counter with a keyboard and a large monitor. Schedule boards, quote builders, and dispatch queues are dense multi-column screens that a phone cannot serve well. The few advisor actions that happen away from the desk — chiefly roadside dispatch — are duplicated in the field app. Reasoning in [[07 System Architecture#7.4a Web application architecture (Next.js)]].

Full screen list in [[12 Screen Inventory]].

### Shared UI requirements

- Single design token set (colour, type scale, spacing) shared across all three clients
- Bottom tab navigation on member app; drawer + task list on field app; sidebar navigation on web
- Persistent offline banner on the field app showing pending-sync item count
- VHS displayed as a colour-coded gauge with a plain-language band label (see [[11 Vehicle Health Score Algorithm#Score bands]])

---

## 5.2 Hardware interfaces

| Interface | Purpose | Required? |
|---|---|---|
| **Device camera** | Inspection photos, vehicle condition records, document capture | 🔴 Required |
| **GPS / location services** | Roadside request location, driver trip tracking, service zone validation | 🔴 Required |
| **Push notification hardware token** | FCM / APNs delivery | 🔴 Required |
| **Local device storage** | Offline queue for inspections and trip updates | 🔴 Required |
| **Biometric sensor** | Optional biometric app unlock (NFR/FR-015) | 🟠 Optional |
| **Bluetooth thermal printer** | Printed COD receipts at counter and roadside | 🟡 Optional |
| **OBD-II Bluetooth dongle** | Telemetry-assisted scoring | ⚪ Deferred — see [[11 Vehicle Health Score Algorithm#Tier 2 — telemetry-assisted scoring]] |

---

## 5.3 Software interfaces

| # | Service | Purpose | Protocol | Failure behaviour |
|---|---|---|---|---|
| SI-1 | **Supabase (Postgres)** | Primary relational datastore | PostgREST / direct Postgres over TLS | API returns 503; client shows retry state |
| SI-2 | **Firebase Authentication** (email/password + Google) | Identity provider, credential storage, password reset, token issuance | Firebase Admin SDK / REST | Login blocked; existing sessions continue until token expiry |
| SI-3 | **Firebase Cloud Messaging** | Push notifications | HTTP v1 API | Fall back to SMS for critical categories (FR-091) |
| SI-4 | **Supabase Storage** | Inspection photos, documents, generated PDFs | S3-compatible API via server-side SDK, signed URLs | Photos queue locally, upload deferred |
| SI-5 | **Payment aggregator** (PayMongo or Xendit) | GCash, Maya, card charges; recurring billing; webhooks | REST + signed webhooks | Charge marked pending; retry per FR-026 |
| SI-6 | **SMS gateway** (Semaphore or Twilio) | Critical fallback notifications only — **not** authentication | REST | Push remains the primary channel; SMS is best-effort |
| SI-7 | **Maps / geocoding** — **Mapbox** (decided 2026-09-11) | Address lookup, reverse geocoding, map rendering, route distance (FR-039) | REST + `@rnmapbox/maps` | Manual address entry remains available (FR-032). Chosen on billing model — mobile is metered by monthly active users (25k free), not per map load — and on exit cost: Mapbox's GL style spec is the one MapLibre forked, so self-hosted OSM tiles remain a swap rather than a rewrite (mitigates R-10). Rationale and token handling in [[19 Roadside Assistance Implementation Plan]] D-2/D-3. |
| SI-8 | **Crash & performance monitoring** (Sentry) | Error tracking | SDK | Non-blocking |

> [!warning] Two identity systems is a real risk
> Firebase Auth (SI-2) issues identity while Supabase (SI-1, SI-4) holds the data **and the files**. Supabase row-level security expects Supabase-issued JWTs. The resolution is documented in [[07 System Architecture#7.3 Reconciling Firebase Auth with Supabase RLS]] — the NestJS API is the sole Supabase client and enforces authorisation itself. Do not let mobile clients talk to Supabase directly, and that includes Storage: files are reached only through short-lived signed URLs the API mints after an authorisation check.

---

## 5.4 Communications interfaces

| Aspect | Specification |
|---|---|
| Client ↔ API | HTTPS, REST, JSON; TLS 1.2+; bearer token in `Authorization` header |
| API versioning | Path-based: `/api/v1/...` |
| Real-time updates | WebSocket (Socket.IO) for roadside status, trip tracking, work order status; polling fallback every 15 s |
| Webhooks inbound | Payment aggregator → `/api/v1/webhooks/payments`, HMAC signature verified, idempotency key required (FR-088) |
| File upload | Direct-to-storage via signed URL issued by the API; the API never proxies file bytes |
| Offline sync | Batched POST of queued operations with client-generated UUIDs for idempotency |
| Data format | JSON, UTF-8; timestamps ISO 8601 with timezone; currency in centavos (integer), never floats |

### API response envelope

```json
{
  "success": true,
  "data": { },
  "meta": { "page": 1, "perPage": 20, "total": 137 },
  "error": null
}
```

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SUBSCRIPTION_LOCKED_IN",
    "message": "This subscription is within its 6-month lock-in period.",
    "details": { "monthsRemaining": 3, "earlyTerminationFee": 149700 }
  }
}
```

> [!note] Currency convention
> All money is an **integer in centavos**. ₱499.00 is `49900`. This eliminates floating-point rounding errors in billing and is enforced at the database column level (`bigint`).

---

> [!info] Navigation
> ⬅️ [[04 Non-Functional Requirements]] · ➡️ [[06 Use Cases]]
