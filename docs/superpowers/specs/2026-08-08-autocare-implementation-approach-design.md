# AutoCare+ — Implementation Approach Design

**Date:** 2026-08-08
**Status:** Approved decisions recorded; supplements the SRS vault (`AutoCare+ Docs/`), which remains the product spec of record.

This document does not restate the SRS. It records the *implementation-approach* decisions needed to start building: repository layout, tooling, platform focus, design-system strategy, and delivery sequencing.

---

## 1. Decisions made

| # | Decision | Choice |
|---|---|---|
| 1 | Repository layout | **Monorepo** — pnpm workspaces + Turborepo |
| 2 | Design system | **Code-first tokens** (`packages/design-tokens`) + rendered style-guide spec page |
| 3 | Delivery sequencing | **Vertical slices** — each phase ships an end-to-end flow across backend, web, and mobile |
| 4 | Mobile platform focus | **iOS first** for development and TestFlight distribution; React Native (Expo) keeps Android buildable throughout — no Android-blocking choices allowed (C-01) |

## 2. Monorepo layout

```
autocare/
├── apps/
│   ├── api/          # NestJS 10 modular monolith (Node 20, Prisma, BullMQ)
│   ├── web/          # Next.js 14+ App Router — /staff, /admin, /c/[token] public
│   ├── member/       # React Native (Expo) member app — iOS-first
│   └── field/        # React Native (Expo) field app — mechanics & drivers
├── packages/
│   ├── contracts/    # Zod schemas + TS types for every endpoint & entity — single source of truth
│   ├── api-client/   # Typed fetch client generated over contracts; used by web + both RN apps
│   ├── design-tokens/# Colors, type scale, spacing, radii, VHS band colors — exported for RN + Tailwind
│   ├── scoring/      # ⭐ Pure VHS engine (zero I/O) — imported by api; golden-test suite lives here
│   └── config/       # Shared eslint, tsconfig, prettier
├── docs/             # Specs and implementation plans (this doc)
└── AutoCare+ Docs/   # SRS vault (spec of record)
```

Rationale notes:
- **`scoring` as a workspace package, not just an API module.** The SRS demands a pure, dependency-free VHS engine (NFR-039, NFR-055). Making it a package enforces the purity boundary mechanically and lets the web/mobile apps reuse band/label logic for display.
- **`contracts` before codegen.** Zod schemas shared by API DTO validation and client parsing satisfy the "one source of truth" rule (§7.4a) and risk R-11 without an OpenAPI toolchain.
- Expo (managed workflow + dev clients + EAS) rather than bare RN: fastest path to TestFlight, supported camera/location/notification modules, and `expo-sqlite`/`op-sqlite` for the offline outbox.

## 3. iOS-first interpretation

The SRS mandates React Native for both platforms (C-01). "iOS first" means:
- Development, simulator testing, and TestFlight builds target iOS 14+ first.
- EAS build profiles include Android from day one; CI compiles both. Android device QA is deferred, not the codebase.
- No iOS-only native modules; anything platform-specific (Keychain/Keystore, push) goes through cross-platform Expo modules.

## 4. Design system strategy

- `packages/design-tokens` is the single source of truth: semantic color roles (light mode first), type scale, spacing, radii, elevation, and the five VHS band colors (which are product data, not decoration — used identically in RN gauges, web dashboards, and public certificates).
- Exports: TS constants (React Native / StyleSheet), Tailwind preset (Next.js web), CSS variables (public certificate pages).
- A rendered style-guide page documents tokens, core components (buttons, cards, status pills, VHS gauge, form fields), and the usage rules the SRS imposes (≥48dp tap targets, 56dp field app, WCAG AA contrast, EN/FIL-ready lengths).
- Visual direction is set with the frontend-design skill during design-system implementation; field app follows the same tokens with a high-contrast, large-target variant.

## 5. Delivery sequencing (vertical slices)

Follows the vault's Wave recommendation (13.2), refined into phases where each phase lands backend + client UI for one coherent flow. Full ordering, tasks, and acceptance criteria live in the implementation plan (`docs/superpowers/plans/`).

- **Phase 0 — Foundation:** monorepo scaffold, design tokens + style guide, CI, Docker Compose (Postgres + Redis), Prisma schema core, auth spine (Firebase ↔ NestJS session exchange — prototype in week 1 per risk R-01).
- **Phase 1 — Identity & vehicles** (M1): register/OTP/consent, vehicle CRUD, member app shell + web login.
- **Phase 2 — Plans, subscription & billing spine** (M2 + M8 core): plans, subscribe, invoice state machine, COD + PayMongo sandbox intents, billing jobs.
- **Phase 3 — Scheduling** (M4): capacity engine, slot holds, member booking flow, advisor schedule board.
- **Phase 4 — Inspection & VHS** (M5): checklists, offline-first field capture, scoring engine integration, score screens, public certificate pages. *The differentiator — largest phase.*
- **Phase 5 — Work orders & parts** (M6): quote builder, per-line approvals, waste records.
- **Phase 6 — Logistics & roadside** (M3 + M7): trips, condition capture, signatures, live tracking, roadside dispatch.
- **Phase 7 — Notifications, admin & analytics** (M9 + M10): FCM + SMS fallback, admin dashboards, reports, audit viewer, DENR export.
- **Phase 8 — Hardening & launch:** NFR verification, store submission, UAT.

## 6. Error handling, testing, cross-cutting

As specified in the SRS (§7.10, NFR-038/039): global exception filter with stable machine codes, Pino structured logs with correlation IDs, CASL policy guards, integer-centavo money everywhere, TDD on business-logic modules (billing, capacity, scoring — scoring gets golden-file tests), Prisma migrations only, all timestamps UTC / presented Asia/Manila.

## 7. Out of scope for this design

Product-scope questions (tier pricing, lock-in length, aggregator choice, etc.) remain open decisions D-1 → D-10 in `13 Constraints and Risks`. The plan uses the documented defaults and keeps them configuration-driven so sign-off never blocks development.
