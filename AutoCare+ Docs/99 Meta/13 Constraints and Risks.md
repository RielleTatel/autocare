---
title: 13 Constraints and Risks
type: meta
project: AutoCare+
version: 1.0
status: draft
tags:
  - constraints
  - risks
---

# 13. Constraints and Risks

> [!info] Navigation
> ⬅️ [[12 Screen Inventory]] · ➡️ [[14 Glossary]] · 🏠 [[AutoCare+ MOC]]

---

## 13.1 Locked constraints

These are decided and not open for redesign.

| ID | Constraint | Implication |
|---|---|---|
| **C-01** | React Native for all mobile clients | One codebase for two platforms. Native modules needed for OBD-II Bluetooth later; background location has platform quirks to budget for. |
| **C-01b** | Next.js for all web clients | Serves the advisor desk, admin console, and public certificate pages from one codebase. Adds a third client to build, but removes the hardest screens from React Native and is the only way to serve link-previewable public certificates. |
| **C-02** | NestJS backend | Good fit. Modular monolith recommended over microservices at this scale. **Note the name collision with Next.js** — they are different tools and both are in the stack. |
| **C-03** | Supabase (Postgres **+ Storage**) + Firebase (auth + push), both free tier | Two identity systems must be reconciled — see [[07 System Architecture#7.3 Reconciling Firebase Auth with Supabase RLS]]. Quotas are a real operational ceiling, and consolidating files onto Supabase makes its **1 GB** Storage cap the tightest one in the stack. |
| **C-04** | COD **and** e-payments | Cash breaks the auto-charge assumption of subscriptions. Handled by the invoice/grace state machine in [[07 System Architecture#7.6 Payment architecture — COD and e-payment together]]. |
| **C-05** | RA 10173 compliance | Consent, export, erasure, breach process all required — see [[10 Security and Privacy]]. |
| **C-06** | Full feature set in v1.0 | The dominant schedule risk. Quantified below. |
| **C-07** | Free-tier quotas | Storage and bandwidth ceilings — Supabase caps at 500 MB database, 1 GB Storage, 5 GB/month egress, 2 active projects. Photo lifecycle management is mandatory, not optional. |
| **C-08** | DENR waste reporting | Requires a data path from the workshop floor to an exportable log. |

---

## 13.2 Scope constraint — full-feature MVP

> [!danger] The single largest risk in this project
> **C-06** commits v1.0 to 117 functional requirements across 92 buildable screens and 3 clients.

### Rough effort

| Workstream | Estimate (person-weeks) |
|---|---|
| Backend — 16 NestJS modules, schema, jobs | 16–22 |
| Member app (React Native) — 38 v1.0 screens (37 + M-38) | 12–17 |
| Field app (React Native) — 18 screens + offline sync | 8–11 |
| Web app (Next.js) — advisor desk, 15 screens | 5–7 |
| Web app (Next.js) — admin console, 17 screens | 6–8 |
| Web app (Next.js) — public certificate pages, 4 screens | 1–2 |
| VHS engine + checklist authoring, incl. Emissions/Sensors categories | 2–3 |
| Attention dashboard aggregation query + real-time refresh | 1–2 |
| Payments (COD + e-payment + reconciliation) | 4–6 |
| QA, UAT, store submission | 6–8 |
| **Total** | **61–86 person-weeks** |
| *Deferred to v1.1, not in above:* 2D visual diagram (illustration assets + `react-native-svg` interaction layer) | *4–7, out of scope for v1.0* |

| Team size | Rough calendar time |
|---|---|
| 1 developer | 15–21 months |
| 2 developers | 8–11 months |
| 3–4 developers | 4–7 months |

> [!note] The Next.js addition is close to effort-neutral
> It adds a third codebase, but the advisor and admin screens had to be built somewhere. Building dense schedule boards and report tables in Next.js is materially cheaper than building them in React Native — roughly offsetting the setup cost of a third client. The public certificate pages are net-new work, but small, and they were not deliverable at all without a web surface.

> [!tip] Recommendation — keep the scope, sequence the delivery
> This is not an argument to cut features. It is an argument to **build in a deliberate order** so that if the timeline compresses, what exists is coherent rather than half of everything.
>
> **Wave 1 (the spine):** Identity → Vehicles → Plans/Subscriptions → Scheduling → Inspection → **VHS** → Work Orders → Payments.
> **Wave 2 (the differentiators):** Pick-up/Delivery, Roadside, Certificates, Notifications.
> **Wave 3 (the operations layer):** Admin analytics, fleet features, waste export, announcements.
>
> Wave 1 alone is a working product. Waves 2 and 3 still ship in v1.0 — this is sequencing, not de-scoping.

---

## 13.3 Technical risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Firebase Auth ↔ Supabase RLS integration fights | High | High | API is sole DB client; RLS as defence only. Prototype this in week 1 before anything else. |
| R-02 | Offline sync produces duplicates or lost inspections | Medium | High | Client UUID idempotency, server receipts, ordered drain, explicit conflict policy. Test with airplane mode from day one. |
| R-03 | Free-tier quota exhaustion mid-launch | Medium | High | 80 % alarm job, aggressive photo compression, containerised for fast migration. **Raised from the original assessment**: moving files onto Supabase Storage drops the file ceiling from 5 GB to 1 GB, so photos are now the most likely quota to blow first. |
| R-04 | Payment aggregator approval delayed | Medium | High | Apply **early** — it is a multi-week external process. COD path means you are not fully blocked. |
| R-05 | App store rejection | Medium | Medium | Submit to internal testing tracks early; prepare privacy nutrition labels and data-safety forms in advance. |
| R-06 | React Native background location drains battery / fails on Android OEM builds | Medium | Medium | Foreground-service tracking only while a trip is active; test on Xiaomi/Oppo/Vivo specifically. |
| R-07 | Push notifications silently fail on aggressive-battery Android OEMs | High | Medium | SMS fallback for critical categories is already mandated (FR-091). |
| R-08 | Checklist thresholds are wrong, producing implausible scores | Medium | High | Mechanic sign-off before launch; calibrate against 20 real vehicles; thresholds are config, so correctable without deployment. |
| R-09 | PDF generation is slow or memory-heavy at scale | Low | Low | Async job queue, cached output. |
| R-10 | Two-vendor lock-in (Supabase + Firebase) changing terms | Low | Medium | Repository abstraction (NFR-037), `StoragePort` abstraction for files, containerisation (NFR-036), single auth touchpoint. Firebase's surface is now auth + push only, so the exposure there is smaller than it was. |
| R-13 | Supabase Storage egress (5 GB/month) exhausted by photo-heavy inspection review | Medium | Medium | Serve thumbnails by default and full resolution only on explicit tap; cache signed URLs client-side for their lifetime rather than re-minting per render. |
| R-11 | Three codebases (2× RN + Next.js) drift apart in types and design | Medium | Medium | Generate TypeScript types from the API and consume in all three; one shared design token package; CI fails the build on type mismatch. |
| R-12 | Firebase Auth session handling differs between web (cookies) and native (Keychain) | Medium | Medium | Both exchange the Firebase ID token at `POST /auth/session`; only the storage mechanism differs. Keep the divergence inside `lib/auth` and never leak it into feature code. |

---

## 13.4 Operational risks the software must surface

These are business risks, but the software is where they become visible early enough to act on.

### Capacity saturation

> [!warning] The failure mode most likely to kill the business
> Members who paid for a service they cannot book will cancel — and tell people why.

| Software response | Requirement |
|---|---|
| Real capacity-aware slot availability (never show a slot that doesn't exist) | FR-042 |
| Walk-in and roadside buffer withheld from online booking | [[07 System Architecture#7.7 Scheduling and capacity engine]] |
| Staggered reminders to spread demand across the month | FR-047 |
| Utilisation alarm before members feel the squeeze | FR-052 |
| Entitlement redemption reporting — is the plan promising more than you can deliver? | FR-097 |

### Roadside assistance abuse

| Software response | Requirement |
|---|---|
| Eligibility waiting period enforced in code | BR-02, FR-034 |
| Lock-in period enforced with a quantified early termination fee | BR-01, FR-028 |
| Per-member roadside cost tracking with a loss-making flag | FR-099 |
| Entitlement quota on roadside calls per cycle | BR-03, FR-021 |

### COD versus recurring subscription

> [!note] The structural awkwardness of cash in a subscription model
> A cash subscriber cannot be auto-charged, so every month you must actively collect. That is an operational cost, and it raises involuntary churn.

| Software response | Requirement |
|---|---|
| Invoice + 7-day grace + escalating state machine | [[07 System Architecture#7.6 Payment architecture — COD and e-payment together]] |
| Push and SMS payment reminders before the due date | FR-090, FR-091 |
| Collection at delivery hand-over (a moment the member is already present) | FR-085 |
| Per-staff, per-shift cash accountability and variance reporting | FR-086 |
| An in-app incentive to switch to e-payment (e.g. a small discount) — **owner decision** | — |

### Score disputes at resale

| Software response | Requirement |
|---|---|
| 90-day validity with visible staleness | BR-05, FR-063 |
| Confidence rating shown alongside every score | [[11 Vehicle Health Score Algorithm#Step 7 — confidence rating]] |
| Immutable inspection records with photographic evidence | NFR-054 |
| Inspection date and odometer on the certificate face | FR-064 |
| Reproducibility from stored config versions | NFR-055 |
| Legal disclaimer wording — **needs legal review** | [[10 Security and Privacy#10.6 Pre-launch security actions]] |

### Roadmap — visual damage diagram (formerly "3D Repair Visualization")

> [!info] Source and scoping decision
> The AUTOCARE MEMBERSHIP APP FEATURES document proposed a photorealistic 3D car model with tappable hotspots and simulated damage rendering — illustrated with reference images of exploded CAD-style vehicle renders. After a feasibility review, this is **not** what ships.

| Option considered | Verdict |
|---|---|
| Per-vehicle-model accurate 3D + damage rendering (as illustrated in the spec) | ❌ Rejected. Requires 3D artists modelling every supported make/model plus a real-time damage-rendering pipeline. Not achievable on a free-tier budget or a small team, and wildly out of proportion to the rest of the app. |
| Generic hotspot 3D model (one rotatable model per body type) | Considered, not chosen. Feasible via `react-three-fiber`/Three.js in React Native, but still a real asset and rendering-engine investment for a feature that a 2D diagram delivers most of the value of. |
| **2D exploded-diagram with tappable zones** ✅ | **Chosen.** Delivers the spec's actual functional goal — "what needs attention, and roughly where" — via labelled illustration + tap targets. Far cheaper to build (a designer produces a handful of SVG/illustration assets, not a 3D pipeline), and reuses the VHS category data exactly as designed in [[11 Vehicle Health Score Algorithm#11.6b Relationship to the (deferred) visual diagram]]. |

| Decision | Detail |
|---|---|
| **Format** | 2D illustrated exploded diagram (SVG or layered image), not 3D |
| **Platform** | Member app only — mechanics keep the structured checklist; no mechanic-facing 3D/2D annotation tool |
| **Phase** | Deferred to **v1.1**, out of the v1.0 full-feature commitment |
| **What v1.0 ships instead** | Everything the diagram would consume is already in v1.0: star ratings, per-component tap-to-explain (FR-115), and the "What Needs Attention" dashboard (FR-109). The diagram is a visual layer on top of data that already exists and is already explainable — v1.0 members get the *information*, just not yet the *illustration*. |
| **What's reserved so v1.1 is cheap** | `checklist_points.diagram_zone_id` (nullable) and `category_scores` already carry everything a diagram needs to colour-code and link back to explanations — see [[08 Data Model#Inspection and scoring entities]]. |

> [!tip] How to describe this to a technical reviewer
> Frame it as "the assessment and the explanation ship now; the illustration ships next" rather than "the 3D feature was cut." Nothing was cut — the scope was matched to what a small team can build credibly, and the data model was designed so the deferred piece is additive, not a rewrite.

---

## 13.5 Open decisions requiring your sign-off

| # | Decision | Why it matters | Default if undecided |
|---|---|---|---|
| D-1 | Final tier pricing and **exactly which consumables** each tier includes | The source concept warns that including synthetic oil at ₱499 is unsustainable | Inspections, fluid top-offs, and labour discounts only at the base tier |
| D-2 | Roadside eligibility waiting period | Directly controls abuse exposure | 30 days after first cleared payment |
| D-3 | Lock-in length and early termination fee formula | Controls churn economics | 6 months; ETF = remaining months × 50 % of monthly fee |
| D-4 | Work approval threshold amount | Below it, work proceeds without asking | ₱1,500 |
| D-5 | Payment aggregator: PayMongo vs Xendit | Determines integration work and fee structure | PayMongo (simpler PH onboarding) |
| D-6 | Bay count and mechanic headcount at launch | The hard input to every capacity calculation | 2 bays, 3 mechanics |
| D-7 | Service zone radius and out-of-zone surcharge | Pick-up economics | 10 km free, ₱30/km beyond |
| D-8 | Whether the workshop OBD-II dongle is in v1.0 | Cheap; materially strengthens the "data-driven" claim | Include — ~₱1,500 one-off |
| D-9 | Partial-payment policy at COD hand-over — release the vehicle or not? | Legal and cash-flow exposure | Release, with the balance as an outstanding invoice |
| D-10 | Data Protection Officer designation | DPA requirement | Must be assigned before launch |
| D-11 | Whether Aircon service bookings get a VHS checklist category | The spec lists Aircon as bookable, but no VHS category covers it today — see [[03 Functional Requirements#3.12 Service catalogue (seed data, not a new module)]] | Aircon bookings don't feed the VHS in v1.0; revisit if members request it |
| D-12 | Whether the 2D visual diagram (v1.1) is built in-house or outsourced to an illustrator | Affects v1.1 timeline and cost, not v1.0 | Not yet needed — revisit at v1.1 planning |

---

## 13.6 Assumptions to validate before building

- [ ] Target members will accept a **6-month lock-in** — test with 20 prospective customers before committing
- [ ] Mechanics will complete a 40-point digital checklist without reverting to paper — pilot with one mechanic for two weeks
- [ ] Mobile data coverage is adequate at the service centre and along common pick-up routes — walk-test it
- [ ] ₱499 and ₱999 are the right price points for this market — validate against actual local PMS pricing
- [ ] A payment aggregator will approve a merchant account for this business type — confirm before development starts

---

> [!info] Navigation
> ⬅️ [[12 Screen Inventory]] · ➡️ [[14 Glossary]] · 🏠 [[AutoCare+ MOC]]
