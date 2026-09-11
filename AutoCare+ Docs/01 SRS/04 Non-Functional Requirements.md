---
title: 04 Non-Functional Requirements
type: srs-section
project: AutoCare+
section: "4"
version: 1.0
status: draft
tags:
  - srs
  - non-functional
---

# 4. Non-Functional Requirements

> [!info] Navigation
> ⬅️ [[03 Functional Requirements]] · ➡️ [[05 External Interface Requirements]]

Every NFR below is stated with a **measurable target** so it can be tested.

---

## 4.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-001 | App cold start to interactive home screen | ≤ 3.0 s on a mid-range Android (4 GB RAM, 4G) |
| NFR-002 | API response time, read endpoints | p95 ≤ 500 ms |
| NFR-003 | API response time, write endpoints | p95 ≤ 1200 ms |
| NFR-004 | VHS computation after inspection submission | ≤ 2 s |
| NFR-005 | Slot availability query | ≤ 800 ms for a 30-day window |
| NFR-006 | Inspection photo upload | Compressed client-side to ≤ 500 KB before upload |
| NFR-007 | Offline inspection sync on reconnect | ≤ 30 s for a full inspection with 20 photos |
| NFR-008 | Concurrent users supported at launch | 500 registered, 50 concurrent, without degradation |

---

## 4.2 Reliability & Availability

| ID | Requirement | Target |
|---|---|---|
| NFR-009 | Platform availability during business hours (07:00–19:00 PHT) | ≥ 99.0 % monthly |
| NFR-010 | Roadside assistance request path availability | ≥ 99.5 % (degrades to hotline per FR-040) |
| NFR-011 | Data durability — no loss of committed inspection or payment records | 100 %; daily automated backups, 30-day retention |
| NFR-012 | Recovery Time Objective after total failure | ≤ 4 hours |
| NFR-013 | Recovery Point Objective | ≤ 24 hours |
| NFR-014 | Offline queue durability on staff devices | Survives app kill and device reboot |

---

## 4.3 Security

| ID | Requirement |
|---|---|
| NFR-015 | All network traffic shall use TLS 1.2 or higher; the app shall reject invalid certificates. |
| NFR-016 | Passwords shall be hashed with bcrypt (cost ≥ 12) or Argon2id. |
| NFR-017 | Access tokens shall expire in 15 minutes; refresh tokens in 30 days with rotation. |
| NFR-018 | Tokens and credentials shall be stored in iOS Keychain / Android Keystore, never in AsyncStorage. |
| NFR-019 | Database access shall be governed by row-level security so a member can read only their own records. |
| NFR-020 | Raw payment card data shall never be transmitted to or stored on AutoCare+ infrastructure (FR-087). |
| NFR-021 | Privileged actions shall be recorded in an append-only audit log (FR-103). |
| NFR-022 | Public VHS certificate links shall use unguessable tokens (≥ 128 bits of entropy) and be revocable. |
| NFR-023 | The API shall rate-limit authentication endpoints to 5 attempts per minute per identifier. |
| NFR-024 | Personal data at rest shall be encrypted (AES-256 via managed database encryption). |

Detail and threat model in [[10 Security and Privacy]].

---

## 4.4 Usability

| ID | Requirement | Target |
|---|---|---|
| NFR-025 | A first-time member shall complete registration, vehicle addition, and subscription in ≤ 5 minutes without assistance. | Usability test, 8 of 10 participants |
| NFR-026 | A mechanic shall complete a full 40-point inspection in ≤ 12 minutes on-device. | Timed trial |
| NFR-027 | Primary tap targets shall be ≥ 48 × 48 dp (field app: ≥ 56 dp for gloved use). | Design audit |
| NFR-028 | Text contrast shall meet WCAG AA (4.5:1 body, 3:1 large text). | Automated audit |
| NFR-029 | The app shall support English and Filipino; VHS results shall use plain language, not workshop jargon. | Content review |
| NFR-030 | Every destructive action (cancel subscription, delete vehicle, revoke certificate) shall require confirmation. | Design audit |
| NFR-031 | The app shall show meaningful empty, loading, and error states on every screen — no blank views. | Design audit |
| NFR-032 | Error messages shall state what went wrong and what the user can do next; no raw error codes. | Content review |

---

## 4.5 Compatibility & Portability

| ID | Requirement |
|---|---|
| NFR-033 | The member and field apps shall run on iOS 14+ and Android 8.0 (API 26)+ from a single React Native codebase (C-01). |
| NFR-034 | The apps shall render correctly from 320 dp to 480 dp width and adapt to tablet layouts for field use. |
| NFR-035 | The Next.js web application shall support the last two versions of Chrome, Edge, and Safari, and shall remain usable down to 1024 px width (C-01b). |
| NFR-035b | Public VHS certificate pages shall be server-rendered, load in ≤ 2.0 s on 4G, and expose OpenGraph metadata so shared links preview correctly on Facebook, Messenger, and Viber. |
| NFR-036 | The backend shall be containerised so it can be redeployed to a different host without code changes (mitigates free-tier lock-in, C-07). |
| NFR-037 | Data-access code shall be isolated behind a repository layer, and file access behind a `StoragePort` interface, so the Supabase/Firebase split can be changed without touching business logic. |

---

## 4.6 Maintainability & Supportability

| ID | Requirement | Target |
|---|---|---|
| NFR-038 | Backend unit test coverage on business-logic modules (billing, VHS, capacity) | ≥ 80 % |
| NFR-039 | The VHS algorithm shall be implemented as a pure, versioned function with a golden-file test suite. | 100 % branch coverage |
| NFR-040 | All configuration (weights, thresholds, prices, capacity) shall be data-driven, not hard-coded (FR-100). | Code review |
| NFR-041 | Structured JSON logging with correlation IDs across client → API → database. | Implementation |
| NFR-042 | Crash reporting and performance monitoring on both apps. | Implementation |
| NFR-043 | API shall be versioned (`/api/v1/...`); breaking changes require a new version. | Code review |
| NFR-044 | Database schema changes shall be applied only through checked-in, reversible migrations. | Code review |

---

## 4.7 Scalability & Cost

| ID | Requirement |
|---|---|
| NFR-045 | The system shall operate within Supabase and Firebase **free-tier quotas** at up to 500 active vehicles, and shall emit a warning when any quota reaches 80 % (C-03, C-07). The binding ceilings are Supabase's 500 MB database, **1 GB Storage**, and 5 GB/month egress. |
| NFR-046 | Inspection photos shall be compressed and lifecycle-managed: full resolution retained 12 months, thumbnails retained indefinitely. Retention shall be reviewed against the 1 GB Supabase Storage ceiling before launch and at each 80 % quota warning. |
| NFR-047 | The architecture shall support vertical scaling to a paid tier without code changes. |
| NFR-048 | SMS usage shall be minimised and metered per FR-095; SMS is the only per-message paid channel. |

---

## 4.8 Legal & Compliance

| ID | Requirement |
|---|---|
| NFR-049 | The system shall comply with RA 10173 (Data Privacy Act): lawful basis, consent capture, data subject rights, breach notification readiness. |
| NFR-050 | Personal data shall be retained only as long as necessary; deletion requests fulfilled within 30 days (FR-013). |
| NFR-051 | Hazardous waste records shall be retained ≥ 3 years and exportable for DENR audit (FR-102). |
| NFR-052 | Financial records (invoices, receipts, refunds) shall be retained ≥ 10 years per BIR requirements. |
| NFR-053 | Terms of service, privacy policy, and subscription cancellation terms shall be presented and versioned in-app, with acceptance timestamped. |

---

## 4.9 Data quality

| ID | Requirement |
|---|---|
| NFR-054 | Inspection records shall be **immutable once submitted**; corrections are new records referencing the original. |
| NFR-055 | Every VHS shall be reproducible from its source inspection and the checklist/weight version in force at the time (FR-101). |
| NFR-056 | Odometer readings shall be validated as monotonically increasing; a decrease requires a recorded justification. |
| NFR-057 | Service records shall never be deleted, only superseded, to preserve the resale-value proposition of the VHS certificate. |

---

> [!info] Navigation
> ⬅️ [[03 Functional Requirements]] · ➡️ [[05 External Interface Requirements]]
