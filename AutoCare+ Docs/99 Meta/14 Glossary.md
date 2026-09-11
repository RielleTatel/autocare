---
title: 14 Glossary
type: meta
project: AutoCare+
version: 1.0
status: draft
tags:
  - glossary
---

# 14. Glossary

> [!info] Navigation
> ⬅️ [[13 Constraints and Risks]] · ➡️ [[15 Requirements Traceability Matrix]] · 🏠 [[AutoCare+ MOC]]

---

## Domain terms

| Term | Definition |
|---|---|
| **Appointment** | A booked time slot for a specific vehicle and service type, occupying a bay and a mechanic. |
| **Band** | The plain-language label for a score range (Excellent / Good / Fair / Needs Attention / Critical). |
| **Bay** | A physical service position in the workshop. The primary capacity constraint. |
| **Certificate** | A shareable, revocable, public view of a Vehicle Health Score used as resale evidence. |
| **Checklist point** | A single item a mechanic evaluates during an inspection (e.g. "front brake pad thickness"). |
| **Condition factor** | The numeric multiplier a status maps to when scoring: 1.00 / 0.75 / 0.40 / 0.00. |
| **Confidence** | How much to trust a score, based on inspection completeness and age. Shown beside the score, never blended into it. |
| **Entitlement** | A service quantity included in a plan per billing cycle (e.g. 1 inspection/month). |
| **Fleet** | A group of vehicles owned by an organisation and managed under one account. |
| **Grace** | The 7-day window after a COD invoice is due during which entitlements remain active. |
| **Inspection** | A structured, checklist-driven examination producing a Vehicle Health Score. Immutable once submitted. |
| **Lock-in** | The minimum subscription commitment period (default 6 months) before penalty-free cancellation. |
| **Member** | A vehicle owner with an active AutoCare+ subscription. |
| **Outbox** | The on-device queue of operations awaiting sync when connectivity returns. |
| **Recommendation** | A quotable work item generated from an adverse inspection finding. |
| **Safety override** | The rule capping the overall score when a safety-critical point is adverse, regardless of the weighted average. |
| **Stale** | A score older than 90 days. Displayed differently; the stored value never changes. |
| **Sub-score** | A per-category score (Engine, Brakes, etc.) that rolls up into the overall VHS. |
| **What Needs Attention** | The home-screen dashboard aggregating open recommendations, adverse findings, and expiring entitlements across all of a member's vehicles. See [[03 Functional Requirements#3.11 M11 — Attention Dashboard & Component Visualization]]. |
| **Star rating** | A 1–5 star display derived from a score band (§11.5 in [[11 Vehicle Health Score Algorithm]]); a presentation layer, not a second scoring system. |
| **Tap-to-explain** | The interaction where tapping any VHS component reveals a templated, plain-language sentence explaining its rating. |
| **Visual diagram** (formerly "3D Repair Visualization") | A deferred (v1.1) 2D exploded-diagram view of the vehicle with tappable, colour-coded zones per VHS category. Scoped down from the original 3D concept for feasibility — see [[13 Constraints and Risks#Roadmap — visual damage diagram (formerly "3D Repair Visualization")]]. |
| **Diagram zone** | A named region of the (future) visual diagram that a checklist point can be mapped to via `diagram_zone_id`. |
| **Trip** | A pick-up or delivery journey performed by a driver. |
| **VHS** | Vehicle Health Score — the 0–100 proprietary condition rating. See [[11 Vehicle Health Score Algorithm]]. |
| **Walk-in buffer** | Capacity deliberately withheld from online booking for walk-in customers and roadside recoveries. |
| **Work order** | The internal job record covering everything done to a vehicle during one visit. |

---

## Technical terms

| Term | Definition |
|---|---|
| **BullMQ** | Redis-backed job queue used for billing runs, reminders, and PDF generation. |
| **CASL** | Authorisation library defining per-role abilities, evaluated in a NestJS guard. |
| **Centavos** | The integer unit all money is stored in. ₱499.00 = `49900`. No floats, ever. |
| **DTC** | Diagnostic Trouble Code — an OBD-II fault code (Tier 2 scoring input). |
| **Idempotency key** | A client-generated identifier ensuring a repeated request has no additional effect. |
| **Modular monolith** | One deployable application with strictly separated internal modules. |
| **NestJS** | The TypeScript **backend** framework serving the API (constraint C-02). Not to be confused with Next.js. |
| **Next.js** | The React **web** framework serving the advisor desk portal, admin console, and public certificate pages (constraint C-01b). Not to be confused with NestJS. |
| **Field app** | The React Native client used by mechanics and drivers — camera, GPS, and offline work. |
| **Advisor desk portal** | The `/staff` route group of the Next.js web app, used by Service Advisors at the counter. |
| **Server component** | A Next.js React component rendered on the server, used for data-dense and public pages. |
| **OBD-II** | On-Board Diagnostics II — the standard vehicle diagnostic port. |
| **Prisma** | Type-safe ORM and migration tool for Postgres. |
| **React Native** | The cross-platform mobile framework (constraint C-01). |
| **RLS** | Row-Level Security — Postgres per-row access policies. |
| **Signed URL** | A short-lived, permissioned URL allowing direct upload to storage without proxying through the API. |
| **Supabase** | Managed Postgres platform used as the primary datastore **and object store** (constraint C-03). |
| **Supabase Storage** | S3-compatible object storage in the same Supabase project as the database; holds inspection photos, OR/CR documents, and generated VHS certificate PDFs. Buckets are private; access is via API-minted signed URLs only. |
| **TanStack Query** | Client-side server-state cache handling retries and optimistic updates. |
| **WatermelonDB** | Offline-first local database for React Native. |

---

## Acronyms

| Acronym | Expansion |
|---|---|
| **BIR** | Bureau of Internal Revenue |
| **BSP** | Bangko Sentral ng Pilipinas |
| **CAC** | Customer Acquisition Cost |
| **COD** | Cash on Delivery |
| **DENR** | Department of Environment and Natural Resources |
| **DPA** | Data Privacy Act of 2012 (RA 10173) |
| **DPO** | Data Protection Officer |
| **ETF** | Early Termination Fee |
| **FCM** | Firebase Cloud Messaging |
| **LTO** | Land Transportation Office |
| **LTV** | Lifetime Value |
| **MRR** | Monthly Recurring Revenue |
| **NPC** | National Privacy Commission |
| **OR/CR** | Official Receipt / Certificate of Registration |
| **PMS** | Preventive Maintenance Service |
| **PSP** | Payment Service Provider |
| **RPO / RTO** | Recovery Point / Time Objective |
| **SRS** | Software Requirements Specification |
| **UAT** | User Acceptance Testing |
| **VHS** | Vehicle Health Score |
| **VIN** | Vehicle Identification Number |

---

> [!info] Navigation
> ⬅️ [[13 Constraints and Risks]] · ➡️ [[15 Requirements Traceability Matrix]] · 🏠 [[AutoCare+ MOC]]
