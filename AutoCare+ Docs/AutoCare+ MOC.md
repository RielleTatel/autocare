---
title: AutoCare+ — Map of Content
type: moc
project: AutoCare+
status: draft
version: 1.0
date: 2026-08-08
tags:
  - autocare
  - moc
  - srs
---

# AutoCare+ — Map of Content

> [!abstract] What this vault contains
> The complete Software Requirements Specification (SRS) and system architecture for **AutoCare+**, a subscription-based preventive automotive maintenance platform for Zamboanga City, Philippines.

---

## Quick facts

| Item | Value |
|---|---|
| Product | AutoCare+ |
| Type | Subscription preventive maintenance platform |
| Market | Zamboanga City, Philippines |
| Mobile clients | React Native — member app + field app (iOS + Android) |
| Web client | Next.js — advisor desk, admin console, public certificates |
| Backend | NestJS (TypeScript) |
| Database / File storage | Supabase (Postgres + Storage) — free tier |
| Auth / Push | Firebase (email/password + Google, FCM) — free tier |
| Payments | COD + e-payments (GCash, Maya, cards) |
| Functional requirements | 117 (FR-001 → FR-117) |
| Buildable v1.0 screens | 92 across 3 clients (2 more deferred to v1.1) |
| Doc version | 1.0 (draft) |
| Last updated | 2026-08-17 |

---

## 01 — Software Requirements Specification

- [[01 Introduction]] — purpose, scope, definitions, references
- [[02 Overall Description]] — product perspective, user classes, constraints, assumptions
- [[03 Functional Requirements]] — the full FR catalogue (FR-001 → FR-117)
- [[04 Non-Functional Requirements]] — performance, security, usability, reliability
- [[05 External Interface Requirements]] — UI, hardware, software, comms interfaces
- [[06 Use Cases]] — actor-goal list and detailed use case specifications

## 02 — Architecture

- [[07 System Architecture]] — layers, components, deployment, tech stack rationale
- [[08 Data Model]] — ERD, entity dictionary, freeform vs structured decision
- [[09 API Specification]] — REST endpoint surface by module
- [[10 Security and Privacy]] — RA 10173 compliance, RLS, threat model

## 03 — Design

- [[11 Vehicle Health Score Algorithm]] — the proprietary scoring engine, in full
- [[12 Screen Inventory]] — every screen, per role, with navigation map

## 04 — Client Handoff

- [[18 Project Description]] — a short, plain-language one-pager: what AutoCare+ is, the problem it solves, and who it's for
- [[16 Application Flow Diagram]] — end-to-end user journey and in-app service flow, with a plain-language handoff section for non-technical stakeholders
- [[17 Technology Architecture Diagram]] — the tech stack in four plain layers, with a "technology at a glance" table and pre-answered client questions

## 99 — Meta

- [[13 Constraints and Risks]] — technical, operational, and scope constraints
- [[14 Glossary]] — every term and acronym used in this vault
- [[15 Requirements Traceability Matrix]] — FR → use case → screen → API → test

---

## Reading order

> [!tip] If you are new to this document set
> 1. [[01 Introduction]] → 2. [[02 Overall Description]] → 3. [[11 Vehicle Health Score Algorithm]] (the core differentiator) → 4. [[07 System Architecture]] → 5. [[03 Functional Requirements]]

> [!tip] If you are the developer starting Sprint 1
> 1. [[07 System Architecture]] → 2. [[08 Data Model]] → 3. [[09 API Specification]] → 4. [[03 Functional Requirements]] → 5. [[13 Constraints and Risks]]

> [!tip] If you are presenting this to a client or non-technical stakeholder
> 1. [[18 Project Description]] → 2. [[16 Application Flow Diagram]] → 3. [[17 Technology Architecture Diagram]] — all three are written to stand alone, with plain-language handoff sections and pre-answered questions, so you don't need to translate the SRS live.

---

## Open decisions

These are recorded in [[13 Constraints and Risks]] and still need your sign-off:

- [ ] Final subscription tier pricing and what consumables each tier includes
- [ ] Minimum lock-in period for roadside assistance eligibility
- [ ] Whether OBD-II dongle integration is in v1.0 or deferred to v1.1
- [ ] Payment aggregator selection (PayMongo vs Xendit)
- [ ] Service centre bay count and mechanic headcount (drives capacity constraints)
- [ ] Whether Aircon bookings get a VHS checklist category (currently no category covers it — D-11)
- [ ] Who builds the deferred v1.1 visual diagram assets — in-house or outsourced illustrator (D-12)

---

## Related

- Source concept document: `AutoCare+.pdf` (in the project root)
- Source feature spec: `AUTOCARE MEMBERSHIP APP FEATURES.pdf` (in the project root) — integrated 2026-08-17; see [[13 Constraints and Risks#Roadmap — visual damage diagram (formerly "3D Repair Visualization")]] for the scoping decision on its 3D visualization proposal
