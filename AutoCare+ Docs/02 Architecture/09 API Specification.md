---
title: 09 API Specification
type: architecture
project: AutoCare+
version: 1.0
status: draft
tags:
  - architecture
  - api
---

# 9. API Specification

> [!info] Navigation
> ⬅️ [[08 Data Model]] · ➡️ [[10 Security and Privacy]] · 🏠 [[AutoCare+ MOC]]

Base URL: `https://api.autocareplus.ph/api/v1`
All responses use the envelope defined in [[05 External Interface Requirements#API response envelope]].

---

## 9.1 Conventions

| Aspect | Rule |
|---|---|
| Auth | `Authorization: Bearer <Firebase ID token>` on all endpoints except those marked 🌐 public |
| Idempotency | `Idempotency-Key` header required on all `POST` that create money or records |
| Pagination | `?page=1&perPage=20`; response `meta` carries `total` |
| Filtering | `?status=ACTIVE&vehicleId=...` |
| Sorting | `?sort=-createdAt` (leading `-` = descending) |
| Errors | Stable machine codes in `error.code`; see §9.12 |
| Money | Integer centavos in every request and response |

---

## 9.2 Auth & users

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `POST` | `/auth/session` | Exchange Firebase token for app session + profile | 🌐 |
| `POST` | `/auth/register` | Create app user after Firebase sign-up | 🌐 |
| `POST` | `/auth/consent` | Record DPA consent (FR-012) | Any |
| `GET` | `/users/me` | Current profile, roles, permissions | Any |
| `PATCH` | `/users/me` | Update profile (FR-011) | Any |
| `POST` | `/users/me/data-export` | DPA data export request (FR-013) | Member |
| `POST` | `/users/me/deletion-request` | DPA erasure request (FR-013) | Member |
| `GET` | `/users` | List staff/members | Admin |
| `PATCH` | `/users/:id/status` | Suspend / reactivate (FR-014) | Admin |

---

## 9.3 Vehicles

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/vehicles` | List owned vehicles | Member, Fleet |
| `POST` | `/vehicles` | Add vehicle (FR-003, FR-004) | Member, Fleet |
| `GET` | `/vehicles/:id` | Detail with latest score and next service | Owner, Staff |
| `PATCH` | `/vehicles/:id` | Update details | Owner |
| `DELETE` | `/vehicles/:id` | Archive (never hard-delete) | Owner |
| `POST` | `/vehicles/:id/odometer` | Record reading (FR-048) | Owner, Staff |
| `GET` | `/vehicles/:id/service-history` | Full digital service record (FR-073) | Owner, Staff |
| `POST` | `/vehicles/bulk-import` | Fleet CSV import (FR-106) | Fleet |
| `GET` | `/vehicles/attention-summary` | **"What Needs Attention"** — aggregated open items across all owned vehicles, severity-sorted (FR-109, FR-110) | Member, Fleet |

---

## 9.4 Plans & subscriptions

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/plans` | Available plans with entitlements (FR-016) | 🌐 |
| `POST` | `/admin/plans` | Create plan (FR-030) | Admin |
| `PATCH` | `/admin/plans/:id` | Update / archive plan | Admin |
| `GET` | `/subscriptions` | My subscriptions | Member, Fleet |
| `POST` | `/subscriptions` | Subscribe a vehicle (FR-017) | Member |
| `GET` | `/subscriptions/:id` | Detail incl. lock-in and next billing | Owner |
| `GET` | `/subscriptions/:id/entitlements` | Remaining quota this cycle (FR-021) | Owner |
| `POST` | `/subscriptions/:id/upgrade` | Immediate, pro-rated (FR-023) | Owner |
| `POST` | `/subscriptions/:id/downgrade` | Effective next cycle (FR-024) | Owner |
| `GET` | `/subscriptions/:id/cancellation-quote` | Early termination fee preview (FR-028) | Owner |
| `POST` | `/subscriptions/:id/cancel` | Request cancellation (FR-025, FR-028) | Owner |

---

## 9.5 Scheduling

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/scheduling/slots` | Available slots (FR-041, FR-042) | Member, Staff |
| `POST` | `/scheduling/holds` | Hold a slot for 10 min (FR-043) | Member |
| `DELETE` | `/scheduling/holds/:id` | Release hold | Member |
| `POST` | `/appointments` | Book (converts hold) | Member, Advisor |
| `GET` | `/appointments` | List, filterable | Member, Staff |
| `PATCH` | `/appointments/:id/reschedule` | Move (FR-044) | Member, Advisor |
| `POST` | `/appointments/:id/cancel` | Cancel (FR-045) | Member, Advisor |
| `GET` | `/scheduling/calendar` | Day / week / bay view (FR-049) | Advisor |
| `POST` | `/admin/capacity-blocks` | Block bay or date (FR-050) | Advisor, Admin |
| `GET` | `/admin/capacity/utilisation` | Utilisation + alarm (FR-052) | Admin |

---

## 9.6 Inspections & scoring

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/checklists/active` | Active checklist version with points and thresholds | Mechanic |
| `POST` | `/inspections` | Start an inspection | Mechanic |
| `PUT` | `/inspections/:id/results` | Submit all results (FR-055 → FR-058) | Mechanic |
| `POST` | `/inspections/:id/submit` | Finalise → triggers scoring (FR-059) | Mechanic |
| `GET` | `/inspections/:id` | Detail incl. results and photos | Owner, Staff |
| `POST` | `/uploads/signed-url` | Get a short-lived direct-to-Supabase-Storage upload URL | Staff |
| `POST` | `/uploads/download-url` | Mint a short-lived read URL for a private stored object, after a CASL check | Any |
| `GET` | `/vehicles/:id/health-score` | Latest score + breakdown + detractors (FR-060) | Owner, Staff |
| `GET` | `/vehicles/:id/health-score/history` | Trend over time and odometer (FR-062) | Owner |
| `POST` | `/vehicles/:id/certificates` | Generate shareable certificate (FR-064) | Owner |
| `PATCH` | `/certificates/:id/visibility` | Change or revoke (FR-065) | Owner |
| `GET` | `/public/certificates/:token` | 🌐 Public certificate view (redacted) | 🌐 |
| `POST` | `/public/certificates/verify` | 🌐 Verify by code | 🌐 |
| `GET` | `/admin/checklists` | Manage checklist versions (FR-100, FR-101) | Admin |
| `POST` | `/admin/checklists/:id/publish` | Publish a new version | Admin |

### Example — `GET /vehicles/:id/health-score`

```json
{
  "success": true,
  "data": {
    "score": 69,
    "rawScore": 84.494,
    "band": "FAIR",
    "confidence": "HIGH",
    "overrideApplied": "SAFETY_ATTENTION",
    "inspectedAt": "2026-08-08T02:14:00Z",
    "odometerKm": 68400,
    "isStale": false,
    "categoryScores": [
      { "categoryCode": "ENGINE",  "label": "Engine & Drivetrain", "weight": 20, "score": 92.0 },
      { "categoryCode": "BRAKES",  "label": "Brakes",              "weight": 18, "score": 75.8 },
      { "categoryCode": "TYRES",   "label": "Tyres & Wheels",      "weight": 15, "score": 70.0 }
    ],
    "topDetractors": [
      {
        "pointCode": "BRAKE_PAD_FRONT",
        "label": "Front brake pad thickness",
        "status": "ATTENTION",
        "measuredValue": 3.0,
        "unit": "mm",
        "recommendation": "Replace front brake pads within 1,000 km"
      }
    ],
    "checklistVersion": "v1.0",
    "weightVersion": "w1.0"
  },
  "meta": null,
  "error": null
}
```

---

## 9.7 Work orders & parts

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `POST` | `/work-orders` | Open a work order | Advisor |
| `GET` | `/work-orders/:id` | Detail with items and approvals | Owner, Staff |
| `PATCH` | `/work-orders/:id/status` | Advance status (FR-070) | Advisor, Mechanic |
| `POST` | `/work-orders/:id/items` | Add part / labour line (FR-071) | Advisor |
| `POST` | `/work-orders/:id/request-approval` | Send for member approval (FR-067) | Advisor |
| `POST` | `/work-orders/:id/items/:itemId/decision` | Approve / decline / defer (FR-068) | Member |
| `POST` | `/work-orders/:id/waste` | Record hazardous waste (FR-074) | Advisor |
| `GET` | `/recommendations` | Open recommendations for a vehicle (FR-069) | Owner, Staff |
| `GET` | `/parts` | Catalogue with stock (FR-072) | Staff |

---

## 9.8 Logistics & roadside

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `POST` | `/trips` | Request pick-up (FR-075) | Member |
| `GET` | `/trips/zone-check` | Validate address, quote surcharge (FR-076) | Member |
| `POST` | `/trips/:id/assign` | Assign driver (FR-077) | Advisor |
| `POST` | `/trips/:id/condition-record` | Pre/post condition + photos (FR-078) | Driver |
| `POST` | `/trips/:id/signature` | Capture hand-over signature, or the member's in-app confirmation (FR-079) | Driver |
| `PATCH` | `/trips/:id/status` | Update status (offline-queued) | Driver |
| `GET` | `/trips/:id/track` | Live driver location (FR-081) | Member |
| `POST` | `/roadside/requests` | Raise emergency request (FR-031 → FR-034) | Member |
| `GET` | `/roadside/eligibility` | Pre-check before showing the button (FR-034) | Member |
| `POST` | `/roadside/requests/:id/dispatch` | Assign responder (FR-037) | Advisor |
| `PATCH` | `/roadside/requests/:id/status` | Status transitions (FR-038) | Advisor, Driver |
| `POST` | `/roadside/requests/:id/resolve` | Record outcome and cost (FR-039) | Advisor |

---

## 9.9 Payments

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `GET` | `/invoices` | My invoices | Member |
| `GET` | `/invoices/:id/pdf` | Download receipt (FR-029) | Member |
| `POST` | `/payments/intents` | Create e-payment intent → checkout URL (FR-083) | Member |
| `POST` | `/payments/cash` | Record COD collection (FR-085) | Advisor, Driver |
| `POST` | `/webhooks/payments` | 🌐 Aggregator webhook, HMAC-verified (FR-088) | 🌐 |
| `POST` | `/cash-shifts/open` | Open a driver/advisor cash shift | Staff |
| `POST` | `/cash-shifts/:id/close` | Close and declare counted cash | Staff |
| `GET` | `/admin/reports/remittance` | Daily reconciliation (FR-086) | Admin |
| `POST` | `/admin/payments/:id/refund` | Full or partial refund (FR-089) | Admin |

---

## 9.10 Sync, notifications, admin

| Method | Endpoint | Purpose | Roles |
|---|---|---|---|
| `POST` | `/sync/batch` | Drain offline outbox (FR-057, FR-082) | Staff |
| `GET` | `/sync/status` | Server view of client sync state | Staff |
| `POST` | `/devices/register` | Register FCM token | Any |
| `GET` | `/notifications` | Notification centre (FR-092) | Any |
| `PATCH` | `/notifications/preferences` | Per-category channels (FR-093) | Any |
| `GET` | `/admin/dashboard` | MRR, churn, capacity (FR-096) | Admin |
| `GET` | `/admin/reports/entitlement-redemption` | FR-097 | Admin |
| `GET` | `/admin/reports/parts-margin` | FR-098 | Admin |
| `GET` | `/admin/reports/roadside-cost` | FR-099 | Admin |
| `GET` | `/admin/reports/waste-log` | CSV/PDF export (FR-102) | Admin |
| `GET` | `/admin/audit-log` | FR-103 | Admin |
| `POST` | `/admin/announcements` | Broadcast (FR-107) | Admin |
| `POST` | `/feedback` | Post-service rating (FR-108) | Member |

---

## 9.11 WebSocket events

Namespace `/realtime`, authenticated with the same bearer token.

| Event | Direction | Payload |
|---|---|---|
| `roadside.status` | → client | `{ requestId, status, etaMinutes?, responder? }` |
| `trip.location` | → client | `{ tripId, lat, lng, updatedAt }` |
| `trip.status` | → client | `{ tripId, status }` |
| `workorder.status` | → client | `{ workOrderId, status }` |
| `workorder.approval_required` | → client | `{ workOrderId, items[], totalCentavos }` |
| `score.ready` | → client | `{ vehicleId, score, band }` |
| `advisor.new_roadside` | → staff | `{ requestId, incidentType, location }` |

---

## 9.12 Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `AUTH_TOKEN_INVALID` | 401 | Firebase token missing, expired, or malformed |
| `FORBIDDEN_ROLE` | 403 | Role lacks permission for this action |
| `CONSENT_REQUIRED` | 403 | DPA consent not on record |
| `PLATE_ALREADY_REGISTERED` | 409 | Plate belongs to another account (FR-005) |
| `SLOT_UNAVAILABLE` | 409 | Slot taken or hold expired (FR-043) |
| `CAPACITY_EXCEEDED` | 409 | No bay or mechanic available (BR-04) |
| `ENTITLEMENT_EXHAUSTED` | 402 | Plan quota used; overage payment required (FR-022) |
| `SUBSCRIPTION_LOCKED_IN` | 409 | Cancellation inside lock-in (BR-01) |
| `SUBSCRIPTION_SUSPENDED` | 402 | Entitlements suspended for non-payment (FR-027) |
| `ROADSIDE_NOT_ELIGIBLE` | 403 | Waiting period not met (BR-02) |
| `OUT_OF_SERVICE_ZONE` | 422 | Address outside coverage (FR-076) |
| `INSPECTION_INCOMPLETE` | 422 | Missing required points or photos |
| `INSPECTION_IMMUTABLE` | 409 | Attempt to edit a submitted inspection (NFR-054) |
| `NOT_CERTIFIED_TECHNICIAN` | 403 | Account lacks certification flag (BR-06) |
| `ODOMETER_REGRESSION` | 422 | Reading lower than last, no justification (NFR-056) |
| `APPROVAL_REQUIRED` | 409 | Work exceeds threshold without approval (BR-07) |
| `CERTIFICATE_REVOKED` | 410 | Public certificate no longer available |
| `PAYMENT_FAILED` | 402 | Aggregator declined |
| `DUPLICATE_REQUEST` | 200 | Idempotency key already processed — original response returned |
| `RATE_LIMITED` | 429 | Throttle exceeded (NFR-023) |

---

> [!info] Navigation
> ⬅️ [[08 Data Model]] · ➡️ [[10 Security and Privacy]] · 🏠 [[AutoCare+ MOC]]
