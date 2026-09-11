---
title: 01 Introduction
type: srs-section
project: AutoCare+
section: "1"
version: 1.0
status: draft
tags:
  - srs
  - introduction
---

# 1. Introduction

> [!info] Navigation
> ⬅️ [[AutoCare+ MOC]] · ➡️ [[02 Overall Description]]

---

## 1.1 Purpose

This document specifies the software requirements for **AutoCare+**, a subscription-based preventive automotive maintenance platform serving vehicle owners in Zamboanga City, Philippines.

It is intended for:

| Audience | What they use it for |
|---|---|
| Development team | Build specification — features, APIs, data model |
| Project stakeholders / owners | Scope agreement and sign-off |
| QA / testers | Basis for test case derivation via [[15 Requirements Traceability Matrix]] |
| Academic reviewers | Technical feasibility evidence for the business feasibility study |

This SRS covers **v1.0 (MVP)**, which by stakeholder decision includes the **full feature set** of the conceptual design rather than a reduced subset. See [[13 Constraints and Risks#Scope constraint — full-feature MVP]] for the risk implications of that decision.

---

## 1.2 Product scope

AutoCare+ replaces the reactive "fix it when it breaks" model with a proactive subscription. The software platform delivers:

- **Membership management** — tiered subscription plans with recurring billing
- **Service scheduling** — member-initiated booking against real service-centre capacity
- **Pick-up and delivery** — in-app request, driver assignment, and live status tracking
- **Digital service records** — a permanent, per-vehicle maintenance history
- **Vehicle Health Score (VHS)** — a proprietary 0–100 condition rating derived from structured inspections, exportable as a shareable resale certificate
- **Roadside assistance** — in-app emergency request with location capture and eligibility checking
- **Payments** — cash on delivery (COD) and e-payments (GCash, Maya, cards)
- **Parts and upsell** — inspection findings surfaced as quotable, approvable work items

### Out of scope for v1.0

> [!warning] Explicitly excluded
> - Real-time OBD-II telematics streaming (deferred — see [[11 Vehicle Health Score Algorithm#Tier 2 — telemetry-assisted scoring]])
> - Insurance product sales or brokerage
> - Third-party marketplace for independent mechanics
> - Multi-city / multi-branch franchising operations
> - Public API for external partners

---

## 1.3 Definitions, acronyms, and abbreviations

Full list lives in [[14 Glossary]]. The critical ones:

| Term | Meaning |
|---|---|
| **VHS** | Vehicle Health Score — 0–100 proprietary condition rating |
| **PMS** | Preventive Maintenance Service — a scheduled service package |
| **Member** | A vehicle owner with an active AutoCare+ subscription |
| **Inspection** | A structured, checklist-driven examination of a vehicle |
| **Work Order** | The internal job record for a service appointment |
| **COD** | Cash on Delivery — payment collected in person by staff |
| **RLS** | Row-Level Security (Postgres/Supabase access control) |
| **DPA** | Data Privacy Act of 2012 (RA 10173) |

---

## 1.4 References

| # | Reference | Relevance |
|---|---|---|
| R1 | AutoCare+ business concept document (`AutoCare+.pdf`) | Source of business requirements |
| R2 | Republic Act 10173 — Data Privacy Act of 2012 | Personal data handling; see [[10 Security and Privacy]] |
| R3 | DENR DAO 2013-22 — Hazardous waste management | Used oil / battery disposal logging requirement |
| R4 | LTO vehicle registration data formats | Vehicle record field definitions |
| R5 | IEEE 830-1998 / ISO/IEC/IEEE 29148 | SRS document structure standard |
| R6 | BSP Circular 1033 — Electronic payments | E-payment provider compliance |

---

## 1.5 Document conventions

> [!note] How to read requirement IDs
> - **FR-nnn** — Functional Requirement, defined in [[03 Functional Requirements]]
> - **NFR-nnn** — Non-Functional Requirement, defined in [[04 Non-Functional Requirements]]
> - **UC-nnn** — Use Case, defined in [[06 Use Cases]]
> - **BR-nnn** — Business Rule, defined inline where it applies

Priority labels used throughout:

| Label | Meaning |
|---|---|
| 🔴 **Must** | v1.0 will not ship without it |
| 🟠 **Should** | Strongly expected in v1.0; degradable if schedule slips |
| 🟡 **Could** | Nice to have; first candidates to cut |
| ⚪ **Won't (this release)** | Explicitly deferred, documented for traceability |

---

## 1.6 Overview of the rest of this document

- [[02 Overall Description]] describes the product context, user classes, operating environment, and the constraints that shape every design decision.
- [[03 Functional Requirements]] enumerates behaviour, grouped by module.
- [[04 Non-Functional Requirements]] sets quality attributes and measurable targets.
- [[05 External Interface Requirements]] defines the boundaries with users, devices, and third-party services.
- [[06 Use Cases]] narrates the main flows end to end.
- [[07 System Architecture]] onward covers the solution design.

---

> [!info] Navigation
> ⬅️ [[AutoCare+ MOC]] · ➡️ [[02 Overall Description]]
