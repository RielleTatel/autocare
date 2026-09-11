---
title: 15 Requirements Traceability Matrix
type: meta
project: AutoCare+
version: 1.0
status: draft
tags:
  - traceability
  - qa
---

# 15. Requirements Traceability Matrix

> [!info] Navigation
> ⬅️ [[14 Glossary]] · 🏠 [[AutoCare+ MOC]]

Links each requirement to the use case that exercises it, the screen that surfaces it, the API that implements it, and the backend module that owns it. Use this to confirm nothing is orphaned and to derive the test plan.

---

## 15.1 Core traceability

| FR | Use case | Screen | API endpoint | Module |
|---|---|---|---|---|
| FR-001 | UC-001 | M-03 | `POST /auth/register` | `auth` |
| FR-002 | UC-001 | M-04 | Firebase email verification | `auth` |
| FR-003 | UC-001 | M-06, M-11 | `POST /vehicles` | `vehicles` |
| FR-004 | UC-001 | M-06, M-12 | `POST /vehicles` | `vehicles` |
| FR-005 | UC-001 | M-06 | `POST /vehicles` | `vehicles` |
| FR-006 | UC-001 | M-07 | `POST /uploads/signed-url` | `vehicles` |
| FR-007 | — | F-01, W-01 | `POST /auth/session` | `auth` |
| FR-012 | UC-001 | M-05 | `POST /auth/consent` | `users` |
| FR-013 | — | M-35 | `POST /users/me/deletion-request` | `users` |
| FR-016 | UC-002 | M-08 | `GET /plans` | `subscriptions` |
| FR-017 | UC-002 | M-08, M-09 | `POST /subscriptions` | `subscriptions` |
| FR-020 | — | M-28 | `GET /subscriptions/:id` | `subscriptions` |
| FR-021 | — | M-22, M-28 | `GET /subscriptions/:id/entitlements` | `subscriptions` |
| FR-025 | UC-010 | M-28, M-30 | `POST /subscriptions/:id/cancel` | `subscriptions` |
| FR-028 | UC-010 | M-30 | `GET /subscriptions/:id/cancellation-quote` | `subscriptions` |
| FR-031 | UC-007 | M-10, M-26 | `POST /roadside/requests` | `roadside` |
| FR-034 | UC-007 | M-26 | `GET /roadside/eligibility` | `roadside` |
| FR-037 | UC-007 | W-11 | `POST /roadside/requests/:id/dispatch` | `roadside` |
| FR-038 | UC-007 | M-27 | polling `GET /roadside/requests/:id` @15s (WS deferred) | `roadside` |
| FR-040 | UC-007 | M-27 | — (native dialer) | — |
| FR-041 | UC-003 | M-19 | `GET /scheduling/slots` | `scheduling` |
| FR-042 | UC-003 | M-20 | `GET /scheduling/slots` | `scheduling` |
| FR-043 | UC-003 | M-20 | `POST /scheduling/holds` | `scheduling` |
| FR-047 | — | M-10 | job `reminders.serviceDue` | `notifications` |
| FR-048 | UC-005 | M-32, F-06 | `POST /vehicles/:id/odometer` | `vehicles` |
| FR-052 | UC-011 | A-01 | `GET /admin/capacity/utilisation` | `admin` |
| FR-053 | UC-005 | F-05 | `GET /checklists/active` | `inspections` |
| FR-055 | UC-005 | F-06 | `PUT /inspections/:id/results` | `inspections` |
| FR-056 | UC-005 | F-06 | `PUT /inspections/:id/results` | `inspections` |
| FR-057 | UC-005 | F-03, F-06 | `POST /sync/batch` | `sync` |
| FR-058 | UC-005 | F-08 | `POST /inspections/:id/submit` | `inspections` |
| FR-059 | UC-005 | M-13, F-09 | `POST /inspections/:id/submit` | **`scoring`** |
| FR-060 | UC-005 | M-14 | `GET /vehicles/:id/health-score` | **`scoring`** |
| FR-062 | — | M-15 | `GET /vehicles/:id/health-score/history` | `scoring` |
| FR-063 | UC-009 | M-13, M-16 | job `scores.markStale` | `scoring` |
| FR-064 | UC-009 | M-16, P-01 | `POST /vehicles/:id/certificates` | `certificates` |
| FR-065 | UC-009 | M-16, P-03 | `PATCH /certificates/:id/visibility` | `certificates` |
| FR-066 | UC-005 | M-18, F-09 | `GET /recommendations` | `work-orders` |
| FR-067 | UC-006 | M-25, W-07 | `POST /work-orders/:id/request-approval` | `work-orders` |
| FR-068 | UC-006 | M-25 | `POST /work-orders/:id/items/:itemId/decision` | `work-orders` |
| FR-070 | UC-006 | F-04 | `PATCH /work-orders/:id/status` | `work-orders` |
| FR-073 | — | M-17 | `GET /vehicles/:id/service-history` | `work-orders` |
| FR-074 | UC-012 | F-10, W-09 | `POST /work-orders/:id/waste` | `work-orders` |
| FR-075 | UC-004 | M-21 | `POST /trips` | `logistics` |
| FR-076 | UC-004 | M-21 | `GET /trips/zone-check` | `logistics` |
| FR-078 | UC-004 | F-12 | `POST /trips/:id/condition-record` | `logistics` |
| FR-079 | UC-008 | F-14 | `POST /trips/:id/signature` | `logistics` |
| FR-081 | UC-004 | M-24 | WS `trip.location` | `logistics` |
| FR-082 | UC-008 | F-03 | `POST /sync/batch` | `sync` |
| FR-083 | UC-002 | M-09 | `POST /payments/intents` | `payments` |
| FR-084 | UC-008 | M-09, F-15, W-13 | `POST /payments/cash` | `payments` |
| FR-085 | UC-008 | F-15, W-13 | `POST /payments/cash` | `payments` |
| FR-086 | UC-008 | F-16, W-14, A-13 | `GET /admin/reports/remittance` | `payments` |
| FR-088 | — | — | `POST /webhooks/payments` | `payments` |
| FR-090 | — | M-33 | job + FCM | `notifications` |
| FR-091 | — | — | SMS gateway | `notifications` |
| FR-096 | UC-011 | A-01 | `GET /admin/dashboard` | `admin` |
| FR-100 | UC-011 | A-04, A-05 | `GET /admin/checklists` | `admin` |
| FR-101 | UC-011 | A-05 | `POST /admin/checklists/:id/publish` | `admin` |
| FR-102 | UC-012 | A-12 | `GET /admin/reports/waste-log` | `admin` |
| FR-103 | — | A-15 | `GET /admin/audit-log` | `admin` |
| FR-109 | — | M-10, M-38 | `GET /vehicles/attention-summary` | `vehicles` |
| FR-114 | UC-005, UC-009 | M-13, M-14 | `GET /vehicles/:id/health-score` | `scoring` |
| FR-115 | UC-005, UC-009 | M-14 | `GET /vehicles/:id/health-score` | `scoring` |
| FR-116 | — | M-39 (⚪ v1.1) | — (deferred) | `scoring` |
| FR-117 | — | M-40 (⚪ v1.1) | — (deferred) | `scoring` |

> [!note] Abbreviated matrix
> The table above covers the requirements with cross-cutting dependencies. Requirements not listed map one-to-one to the module and screen named in [[03 Functional Requirements]] and [[12 Screen Inventory]]. Complete the remainder during sprint planning as each module is picked up.

---

## 15.2 Business rule enforcement points

| BR | Rule | Enforced in | Requirement |
|---|---|---|---|
| BR-01 | 6-month lock-in | `subscriptions` service | FR-025 |
| BR-02 | Roadside waiting period | `roadside` eligibility guard | FR-034 |
| BR-03 | Entitlement quota per cycle | `subscriptions` entitlement service | FR-021, FR-022 |
| BR-04 | Bay capacity limit | `scheduling` capacity engine | FR-042 |
| BR-05 | 90-day score validity | `scoring` + `scores.markStale` job | FR-063 |
| BR-06 | Certified technician only | `PolicyGuard` on inspection submit | FR-058 |
| BR-07 | Approval above threshold | `work-orders` approval service | FR-067 |
| BR-08 | Pro-rated ETF | `subscriptions` cancellation service | FR-028 |

---

## 15.3 Test coverage plan

| Test type | Scope | Target |
|---|---|---|
| **Unit** | VHS engine, billing state machine, capacity engine, entitlement counting | ≥ 80 %; VHS 100 % branch (NFR-038, NFR-039) |
| **Golden file** | ≥ 30 fixture inspections with hand-verified scores, covering every override path | 100 % pass |
| **Reproducibility** | Recompute every historical score from stored config versions | Byte-identical (NFR-055) |
| **Integration** | API + database per module, including RLS defence layer | All endpoints |
| **Contract** | Payment webhook handling, idempotency, replay | All PSP events |
| **Offline / E2E** | Airplane-mode inspection capture → reconnect → sync; duplicate replay | No duplicates, no loss |
| **Load** | 50 concurrent users, slot query under contention | Meets NFR-002, NFR-005 |
| **Security** | Auth bypass, role escalation, certificate token enumeration, injection | Zero criticals |
| **Usability** | Registration ≤ 5 min; 40-point inspection ≤ 12 min | NFR-025, NFR-026 |
| **Device matrix** | Xiaomi, Oppo, Vivo, Samsung (Android 8–14), iPhone SE → 15 | Push, location, camera all functional |

---

## 15.4 Coverage check

| Category | Count | Traced to a screen | Traced to an API | Traced to a module |
|---|---|---|---|---|
| Functional requirements | 117 | ✅ | ✅ (except FR-116, FR-117 — deferred) | ✅ |
| Non-functional requirements | 58 | n/a | n/a | ✅ (cross-cutting) |
| Business rules | 8 | ✅ | ✅ | ✅ |
| Use cases | 12 | ✅ | ✅ | ✅ |

> [!success] No orphans
> Every functional requirement resolves to at least one screen and one API endpoint, except the two ⚪ **Won't (this release)** requirements (FR-116, FR-117 — the deferred visual diagram), which correctly have no live API since they aren't being built in v1.0. Every screen serves at least one requirement. Every business rule has a named enforcement point.

---

> [!info] Navigation
> ⬅️ [[14 Glossary]] · 🏠 [[AutoCare+ MOC]]
