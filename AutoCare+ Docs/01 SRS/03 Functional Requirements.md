---
title: 03 Functional Requirements
type: srs-section
project: AutoCare+
section: "3"
version: 1.0
status: draft
tags:
  - srs
  - functional-requirements
---

# 3. Functional Requirements

> [!info] Navigation
> ⬅️ [[02 Overall Description]] · ➡️ [[04 Non-Functional Requirements]]

> [!abstract] Priority legend
> 🔴 Must · 🟠 Should · 🟡 Could · ⚪ Won't (this release)
>
> Per constraint **C-06**, v1.0 ships the complete feature set. The priority column therefore indicates *implementation order and cut-risk*, not scope exclusion.

---

## 3.1 M1 — Identity & Accounts

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-001 | The system shall allow a prospective member to register using email address + password, or Google sign-in, and shall collect a mobile number as a contact detail during registration. | Member | 🔴 |
| FR-002 | The system shall verify the email address via a single-use verification link, and shall gate completion of onboarding until that address is verified. | Member | 🔴 |
| FR-003 | The system shall allow a member to add one or more vehicles to their account. | Member | 🔴 |
| FR-004 | The system shall capture per vehicle: plate number, make, model, year, variant, engine displacement, fuel type, transmission, odometer reading, colour, and optional VIN/chassis number. | Member | 🔴 |
| FR-005 | The system shall validate plate number format against Philippine LTO patterns and reject duplicates within the same account. | System | 🟠 |
| FR-006 | The system shall allow a member to upload photos of the vehicle and its OR/CR documents. | Member | 🟠 |
| FR-007 | The system shall support role-based accounts: Member, Fleet Manager, Mechanic, Service Advisor, Driver, Administrator. | System | 🔴 |
| FR-008 | The system shall allow a Fleet Manager to register a corporate account and attach up to a configurable number of vehicles. | Fleet Manager | 🟠 |
| FR-009 | The system shall allow a Fleet Manager to assign named drivers to specific vehicles. | Fleet Manager | 🟠 |
| FR-010 | The system shall allow password reset via a single-use link sent to the registered email address. | Member | 🔴 |
| FR-011 | The system shall allow a member to edit profile details (name, email, address, emergency contact). | Member | 🔴 |
| FR-012 | The system shall record and display a DPA-compliant consent statement at registration, with timestamp. | System | 🔴 |
| FR-013 | The system shall allow a member to request account deletion and data export (DPA rights). | Member | 🔴 |
| FR-014 | The system shall allow an administrator to suspend or reactivate any account with a recorded reason. | Admin | 🟠 |
| FR-015 | The system shall enforce session expiry after 30 days of inactivity and support biometric unlock on supported devices. | System | 🟠 |

---

## 3.2 M2 — Subscription & Billing

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-016 | The system shall present all available subscription plans with price, inclusions, entitlement quotas, and exclusions. | Member | 🔴 |
| FR-017 | The system shall allow a member to subscribe a **specific vehicle** to a plan (subscription is per-vehicle, not per-account). | Member | 🔴 |
| FR-018 | The system shall support multiple concurrent subscriptions under one account, one per vehicle. | Member | 🔴 |
| FR-019 | The system shall create a recurring monthly billing schedule on subscription activation. | System | 🔴 |
| FR-020 | The system shall display the next billing date, amount, and payment method on the member dashboard. | Member | 🔴 |
| FR-021 | The system shall track **entitlement consumption** per billing cycle (inspections used, pick-ups used, roadside calls used) and display remaining balance. | System | 🔴 |
| FR-022 | The system shall block or bill-as-extra any service request that exceeds the plan's entitlement quota, per **BR-03**. | System | 🔴 |
| FR-023 | The system shall allow a member to upgrade a plan immediately, with pro-rated charging. | Member | 🟠 |
| FR-024 | The system shall allow a member to downgrade a plan, effective at the next billing cycle. | Member | 🟠 |
| FR-025 | The system shall enforce a minimum 6-month lock-in period per **BR-01** and display remaining lock-in months. | System | 🔴 |
| FR-026 | The system shall place a subscription in `PAST_DUE` state after a failed charge and retry on days 1, 3, and 7. | System | 🔴 |
| FR-027 | The system shall suspend service entitlements when a subscription reaches `SUSPENDED` state after 3 failed retries. | System | 🔴 |
| FR-028 | The system shall calculate and present a pro-rated early termination fee when cancellation is requested inside the lock-in, per **BR-08**. | System | 🔴 |
| FR-029 | The system shall issue an itemised digital receipt/invoice for every successful charge, downloadable as PDF. | Member | 🟠 |
| FR-030 | The system shall allow an administrator to create, edit, archive, and price subscription plans without a code deployment. | Admin | 🔴 |

---

## 3.3 M3 — Roadside Assistance

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-031 | The system shall provide a prominent emergency assistance button on the member home screen. | Member | 🟢 |
| FR-032 | The system shall capture the member's GPS coordinates, reverse-geocoded address, and allow a manual landmark description. | Member | 🟢 |
| FR-033 | The system shall let the member select an incident type: flat tyre, dead battery, out of fuel, overheating, will-not-start, accident, other. | Member | 🟢 |
| FR-034 | The system shall verify roadside eligibility per **BR-02** (active subscription + first payment cleared + 30 days elapsed) before accepting the request. | System | 🟢 |
| FR-035 | The system shall display a clear, non-punitive message with paid alternatives when the member is not yet eligible. | System | 🟢 |
| FR-036 | The system shall notify all on-duty service advisors of a new roadside request within 30 seconds. | System | 🔴 |
| FR-037 | The system shall allow a service advisor to dispatch a driver or a contracted tow partner and record the assignment. | Advisor | 🟢 |
| FR-038 | The system shall show the member live status: `REQUESTED → ACKNOWLEDGED → DISPATCHED → EN_ROUTE → ON_SITE → RESOLVED`. | Member | 🟢 |
| FR-039 | The system shall log the resolution outcome, time on site, distance travelled, and any parts consumed. | Advisor | 🟠 |
| FR-040 | The system shall allow the member to place a direct call to the dispatch hotline as a fallback if the app request fails. | Member | 🟢 |

> FR-039 stays amber: resolution notes, cost and Mapbox-computed distance are captured, but time on site and parts consumed are not — they belong with the work-order/parts modules.
>
> FR-036 is partially met: new requests appear on the advisor dispatch board (`GET /roadside/board`), but there is no push transport yet, so the 30-second guarantee is not enforced. Tracked with the notifications project.

---

## 3.4 M4 — Scheduling & Capacity

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-041 | The system shall let a member browse available appointment slots by date and service type. | Member | 🔴 |
| FR-042 | The system shall compute slot availability from configured bay count, mechanic availability, service duration, and existing bookings, per **BR-04**. | System | 🔴 |
| FR-043 | The system shall prevent overbooking by holding a slot for 10 minutes during booking and releasing it on abandonment. | System | 🔴 |
| FR-044 | The system shall allow a member to reschedule an appointment up to 24 hours before the slot, at no charge. | Member | 🔴 |
| FR-045 | The system shall allow a member to cancel an appointment and shall record a no-show if the member neither attends nor cancels. | Member | 🟠 |
| FR-046 | The system shall flag accounts with 3 or more no-shows in 6 months for administrator review. | System | 🟡 |
| FR-047 | The system shall generate **due-service reminders** based on elapsed time since last service, odometer delta, and manufacturer interval defaults. | System | 🔴 |
| FR-048 | The system shall allow a member to record their current odometer reading at any time, to improve interval accuracy. | Member | 🔴 |
| FR-049 | The system shall present a day view, week view, and per-bay view of the schedule to service advisors. | Advisor | 🔴 |
| FR-050 | The system shall allow an advisor to manually create, move, or block appointments and to block bays for maintenance or holidays. | Advisor | 🔴 |
| FR-051 | The system shall allow an administrator to configure operating hours, holidays, bay count, and per-service standard durations. | Admin | 🔴 |
| FR-052 | The system shall display a **capacity utilisation indicator** to administrators, warning when forward bookings exceed a configurable threshold of capacity. | Admin | 🟠 |

> [!warning] Why FR-052 matters
> The source concept identifies capacity-vs-subscriber-count as the primary operational failure mode: members who paid but cannot get an appointment will churn. FR-052 turns that business risk into a monitored software signal. See [[13 Constraints and Risks#Capacity saturation]].

---

## 3.5 M5 — Inspection & Vehicle Health Score

| ID     | Requirement                                                                                                                                                                                                | Actor    | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| FR-053 | The system shall provide **versioned, structured inspection checklists** composed of categories and inspection points.                                                                                     | System   | 🔴       |
| FR-054 | The system shall define at minimum these categories: Engine, Brakes, Tyres & Wheels, Battery & Electrical, Fluids, Suspension & Steering, Lights & Visibility, Body & Undercarriage.                       | System   | 🔴       |
| FR-055 | The system shall accept per inspection point a status of `GOOD` / `MONITOR` / `ATTENTION` / `CRITICAL` / `NOT_APPLICABLE`, plus optional measured value, unit, note, and photos.                           | Mechanic | 🔴       |
| FR-056 | The system shall support measured numeric inputs (tyre tread mm, battery voltage V, brake pad mm, fluid level %) and derive status from configured thresholds.                                             | System   | 🔴       |
| FR-057 | The system shall function **offline** during inspection capture and sync results when connectivity is restored.                                                                                            | Mechanic | 🔴       |
| FR-058 | The system shall accept inspection submissions only from accounts with the Mechanic role and a valid certification flag, per **BR-06**.                                                                    | System   | 🔴       |
| FR-059 | The system shall compute a **Vehicle Health Score (0–100)** from a submitted inspection using the algorithm in [[11 Vehicle Health Score Algorithm]].                                                      | System   | 🔴       |
| FR-060 | The system shall compute and display **category sub-scores** alongside the overall score.                                                                                                                  | System   | 🔴       |
| FR-061 | The system shall store every score as an immutable, timestamped record linked to its source inspection.                                                                                                    | System   | 🔴       |
| FR-062 | The system shall display VHS history as a trend chart over time and odometer.                                                                                                                              | Member   | 🟠       |
| FR-063 | The system shall mark a score as `STALE` after 90 days per **BR-05** and visually distinguish stale scores.                                                                                                | System   | 🔴       |
| FR-064 | The system shall generate a **shareable VHS certificate** (public read-only link + PDF) containing score, category breakdown, inspection date, odometer, service history summary, and a verification code. | Member   | 🔴       |
| FR-065 | The system shall allow the member to control certificate visibility: private, link-only, or revoked; and shall redact the member's personal contact details from the public view.                          | Member   | 🔴       |

---

## 3.6 M6 — Work Orders & Parts

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-066 | The system shall generate quotable **recommended work items** from inspection findings of status `ATTENTION` or `CRITICAL`. | System | 🔴 |
| FR-067 | The system shall require explicit in-app member approval before performing any work above a configurable amount, per **BR-07**. | Member | 🔴 |
| FR-068 | The system shall allow the member to approve, decline, or defer each line item individually. | Member | 🔴 |
| FR-069 | The system shall record a declined recommendation and re-surface it at the next inspection if still unresolved. | System | 🟠 |
| FR-070 | The system shall track work order status: `DRAFT → AWAITING_APPROVAL → APPROVED → IN_PROGRESS → QC → READY → CLOSED`. | Advisor | 🔴 |
| FR-071 | The system shall itemise parts and labour separately, with quantity, unit price, and applied member discount. | System | 🔴 |
| FR-072 | The system shall maintain a parts catalogue with stock levels and decrement stock on work order closure. | Admin | 🟠 |
| FR-073 | The system shall append every closed work order to the vehicle's permanent digital service record. | System | 🔴 |
| FR-074 | The system shall record hazardous waste generated per work order (used oil litres, batteries, filters, tyres) for DENR reporting, per **C-08**. | Advisor | 🔴 |

---

## 3.7 M7 — Pick-up & Delivery

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-075 | The system shall allow a member to request vehicle pick-up when booking an appointment, specifying address, preferred time window, and contact person. | Member | 🔴 |
| FR-076 | The system shall validate that the pick-up address falls within a configured service radius/zone and quote any out-of-zone surcharge. | System | 🔴 |
| FR-077 | The system shall allow an advisor to assign a driver to a pick-up or delivery trip. | Advisor | 🔴 |
| FR-078 | The system shall require the driver to capture a **pre-trip vehicle condition record** — exterior photos from 4 angles, odometer photo, fuel level, and existing damage notes — before departure. | Driver | 🔴 |
| FR-079 | The system shall capture the member's digital signature at hand-over and at return; where the member is not present in person, an in-app confirmation from the member's own authenticated session serves as the equivalent. | Driver | 🔴 |
| FR-080 | The system shall show the member the trip status and the assigned driver's name, photo, and contact number. | Member | 🔴 |
| FR-081 | The system shall share the driver's live location with the member while the trip is active, and stop sharing on completion. | Member | 🟠 |
| FR-082 | The system shall queue trip status updates offline and sync them when the driver regains connectivity. | Driver | 🔴 |

---

## 3.8 M8 — Payments

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-083 | The system shall support **e-payment** methods: GCash, Maya, and credit/debit cards, through a Philippine payment aggregator. | Member | 🔴 |
| FR-084 | The system shall support **cash on delivery / cash at counter (COD)** as a first-class payment method for both subscriptions and work orders. | Member | 🔴 |
| FR-085 | The system shall allow staff to record a COD collection, capture the amount tendered and change, and issue a digital receipt. | Advisor / Driver | 🔴 |
| FR-086 | The system shall reconcile COD collections per staff member per day and produce a cash remittance report. | Admin | 🔴 |
| FR-087 | The system shall tokenise and store e-payment instruments through the aggregator; **raw card data shall never touch AutoCare+ servers**. | System | 🔴 |
| FR-088 | The system shall handle payment webhooks idempotently and reconcile them against internal payment records. | System | 🔴 |
| FR-089 | The system shall support full and partial refunds initiated by an administrator, with a recorded reason. | Admin | 🟠 |

> [!important] COD and recurring billing interact awkwardly
> A cash-paying subscriber cannot be auto-charged. For COD subscriptions the system issues a **due invoice** on the billing date and holds entitlements in a grace state until the cash is recorded. This is deliberate: excluding cash would exclude a large share of the target market. See [[13 Constraints and Risks#COD versus recurring subscription]].

---

## 3.9 M9 — Notifications

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-090 | The system shall send push notifications for: appointment confirmations, reminders (T-24h and T-2h), service due, work-order approval requests, work completion, payment due, payment success/failure, and roadside status changes. | System | 🔴 |
| FR-091 | The system shall fall back to SMS for **critical** notifications (payment due, roadside status, appointment confirmation) when push delivery fails or is disabled. | System | 🔴 |
| FR-092 | The system shall maintain an in-app notification centre with read/unread state and 90-day retention. | Member | 🟠 |
| FR-093 | The system shall let members configure notification preferences per category and per channel. | Member | 🟠 |
| FR-094 | The system shall respect a quiet-hours window (default 22:00–07:00) for non-emergency notifications. | System | 🟡 |
| FR-095 | The system shall log every notification send attempt with channel, status, and cost for SMS. | System | 🟠 |

---

## 3.10 M10 — Admin & Analytics

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-096 | The system shall provide an administrator dashboard showing active subscribers, MRR, churn rate, and capacity utilisation. | Admin | 🔴 |
| FR-097 | The system shall report **entitlement redemption rate** per plan — how much of what members pay for is actually consumed. | Admin | 🟠 |
| FR-098 | The system shall report parts revenue and margin separately from subscription revenue. | Admin | 🟠 |
| FR-099 | The system shall report roadside assistance cost per member and flag members whose usage cost exceeds their lifetime payments. | Admin | 🟠 |
| FR-100 | The system shall allow configuration of inspection checklists, scoring weights, and thresholds without a code deployment. | Admin | 🔴 |
| FR-101 | The system shall version checklist and weight changes so historical scores remain reproducible. | System | 🔴 |
| FR-102 | The system shall provide a hazardous waste log exportable as CSV/PDF for DENR submission. | Admin | 🔴 |
| FR-103 | The system shall maintain an immutable audit trail of privileged actions (pricing changes, refunds, account suspensions, score overrides). | System | 🔴 |
| FR-104 | The system shall allow an administrator to define service zones and out-of-zone surcharges. | Admin | 🟠 |
| FR-105 | The system shall support fleet-level reporting: aggregate VHS, cost per vehicle, downtime per vehicle. | Fleet Manager | 🟠 |
| FR-106 | The system shall allow bulk import of fleet vehicles via CSV. | Fleet Manager | 🟡 |
| FR-107 | The system shall allow an administrator to broadcast an announcement to all or segmented members. | Admin | 🟡 |
| FR-108 | The system shall record member feedback and a 1–5 rating after each completed service. | Member | 🟠 |

---

## 3.11 M11 — Attention Dashboard & Component Visualization

> [!info] Source
> This module implements the **"What Needs Attention" dashboard** and the **VHS component-interaction / visualization** features from the AUTOCARE MEMBERSHIP APP FEATURES document. It reuses the scoring data already produced by M5 — it adds no new scoring logic, only new ways of surfacing what M5 already computes.

| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-109 | The system shall display a **"What Needs Attention"** section on the member home screen, aggregating across all of the member's vehicles: open recommendations, components at `ATTENTION`/`CRITICAL` status, entitlements about to expire unused, and upcoming/overdue services. | Member | 🔴 |
| FR-110 | The system shall sort attention items by severity (`CRITICAL` first) and then recency, and shall show which vehicle each item belongs to when the member has more than one. | System | 🔴 |
| FR-111 | The system shall deep-link each attention item to its source screen (recommendation detail, booking flow, or subscription renewal) in one tap. | Member | 🔴 |
| FR-112 | The system shall recompute the attention dashboard whenever a new inspection is submitted, a recommendation is created or resolved, or a subscription state changes — without requiring the member to refresh manually. | System | 🟠 |
| FR-113 | The system shall show an empty-state message on the attention dashboard when no vehicle has outstanding items, rather than hiding the section. | System | 🟡 |
| FR-114 | The system shall render the overall Vehicle Health Score and each category sub-score as a **star rating (1–5)** alongside the numeric score, per the mapping in [[11 Vehicle Health Score Algorithm#11.5 Score bands]]. | Member | 🔴 |
| FR-115 | The system shall allow the member to tap **any** displayed component or category — not only ones flagged as detractors — to reveal a plain-language explanation of its rating, per [[11 Vehicle Health Score Algorithm#11.6a Tap-to-explain: plain-language descriptions for every component]]. | Member | 🔴 |
| FR-116 | ⚪ The system shall display an interactive 2D exploded-diagram view of the vehicle, with tappable zones per VHS category, colour-coded by that category's status. **Deferred to v1.1** — see [[13 Constraints and Risks#Roadmap — visual damage diagram (formerly "3D Repair Visualization")]]. | Member | ⚪ |
| FR-117 | ⚪ The system shall visually highlight, on the diagram, which component corresponds to a tapped attention item or recommendation. **Deferred to v1.1**, dependent on FR-116. | Member | ⚪ |

---

## 3.12 Service catalogue (seed data, not a new module)

> [!info] From the spec
> The AUTOCARE MEMBERSHIP APP FEATURES document lists the actual services a member chooses from during booking (§3.4 M4, FR-041). These were previously modelled only as a generic `service_types` table with no example rows — they're now the documented v1.0 seed data.

| `service_types.code` | Name | Notes |
|---|---|---|
| `PMS` | Preventive Maintenance Service | The core subscription entitlement service |
| `OIL_CHANGE` | Change Oil | High frequency; drives FR-047 reminders |
| `OBD_SCAN` | OBD Scanning | Also the entry point for Tier 2 telemetry (§11.8) if added |
| `UNDERCHASSIS` | Underchassis | Suspension/steering category inspection pairs well here |
| `AIRCON` | Aircon | Not covered by any current VHS category — flagged below |
| `MECHANICAL` | Mechanics (general repair) | Maps to work orders raised from recommendations |
| `BODY_REPAINT` | Body Repair & Repaint | Maps to the Body & Undercarriage VHS category |
| `PARTS_ACCESSORIES` | Parts & Accessories | Retail-only; may not consume a bay/mechanic slot — confirm with FR-042 capacity logic before launch |

> [!warning] Gap this surfaces: Aircon has no VHS category
> The spec lists "Aircon" as a bookable service but no VHS category covers air-conditioning condition. Either add a lightweight **Climate Control** checklist category in a later checklist version, or accept that Aircon bookings don't feed the health score. Flagged as open decision **D-11** in [[13 Constraints and Risks#13.5 Open decisions requiring your sign-off]].

Each row seeds `service_types` (FR-051 configures durations; admin can add/edit via A-06). No new FR is needed for the catalogue itself since FR-041/FR-051 already cover it generically — this table exists so implementers use the spec's actual names instead of inventing new ones.

---

## 3.13 Requirement counts

| Module | Count | Must | Should | Could | Won't (this release) |
|---|---|---|---|---|---|
| M1 Identity | 15 | 9 | 6 | 0 | 0 |
| M2 Subscription | 15 | 12 | 3 | 0 | 0 |
| M3 Roadside | 10 | 9 | 1 | 0 | 0 |
| M4 Scheduling | 12 | 9 | 2 | 1 | 0 |
| M5 Inspection & VHS | 13 | 12 | 1 | 0 | 0 |
| M6 Work Orders | 9 | 7 | 2 | 0 | 0 |
| M7 Pick-up & Delivery | 8 | 7 | 1 | 0 | 0 |
| M8 Payments | 7 | 6 | 1 | 0 | 0 |
| M9 Notifications | 6 | 2 | 3 | 1 | 0 |
| M10 Admin | 13 | 5 | 6 | 2 | 0 |
| M11 Attention & Visualization | 9 | 5 | 1 | 1 | 2 |
| **Total** | **117** | **83** | **27** | **5** | **2** |

> [!danger] Scope reality check
> 117 functional requirements with 83 rated Must is a **large** v1.0 — nine requirements larger than before this integration. This is a direct consequence of constraint **C-06** (full-feature MVP). [[13 Constraints and Risks#13.2 Scope constraint — full-feature MVP]] quantifies the effort and proposes a fallback if the schedule slips. The two ⚪ **Won't (this release)** items (FR-116, FR-117) are the visual diagram, explicitly deferred to v1.1 per the phasing decision — everything else in M11 is cheap because it reuses M5's data rather than computing anything new.

---

> [!info] Navigation
> ⬅️ [[02 Overall Description]] · ➡️ [[04 Non-Functional Requirements]]
