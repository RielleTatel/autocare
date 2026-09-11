# Phase 6 — Logistics & Roadside Implementation Plan (DRAFT)

> **Status: DRAFT** — expand into bite-sized TDD steps at phase start.
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Pick-up & delivery trips with condition records, signatures, live tracking, and driver COD; roadside emergencies from SOS tap to resolved, with a live advisor dispatch queue.

**Covers:** M7 (FR-075→FR-082) + M3 (FR-031→FR-040). Screens F-11→F-18; M-21 (unstubbed), M-24, M-26, M-27; W-10→W-12. BR-02. Risks R-06 (battery/OEM location quirks), NFR-010 (roadside path ≥99.5%).

**Prerequisites:** Phases 0–5 (outbox/sync infra from Phase 4, entitlements from Phase 2, booking pick-up stub from Phase 3, driver cash from Phase 2's shift machinery).

## Global Constraints (additional)

- Roadside eligibility (BR-02): active subscription + first payment cleared + 30 days elapsed + `ROADSIDE` entitlement remaining — checked server-side at request creation (`ROADSIDE_NOT_ELIGIBLE` 403) and pre-checked via `GET /roadside/eligibility` so the UI never sets up a failed SOS. Ineligible message is non-punitive with paid alternatives (FR-035).
- Location sharing: driver location only while a trip/response is active, foreground service only, stops on completion (FR-081, R-06); traces retained 30 days (Data Model §8.6).
- Trip status updates and condition records are offline-queueable (FR-082) via the Phase 4 outbox (`entityType: "trip_status" | "trip_condition"`); conflict policy server-wins for assignment, client-wins for condition content.
- Advisors notified of a new roadside request within 30 s (FR-036): Socket.IO `advisor.new_roadside` + fallback poll every 20 s in the dispatch queue.
- Hotline fallback number rendered prominently on every roadside screen (FR-040) — the app path failing must never strand a member.
- Zones: polygons in `service_zones`; out-of-zone → surcharge quote or rejection (`OUT_OF_SERVICE_ZONE` 422) (FR-076, D-7 defaults: 10 km free, ₱30/km beyond).

## Tasks

### Task 1: Schema — trips, condition records, roadside, zones
`Trip { appointmentId, type PICKUP|DELIVERY, driverUserId?, address, lat, lng, windowStart/End, status REQUESTED|ASSIGNED|EN_ROUTE|ARRIVED|IN_TRANSIT|COMPLETED|CANCELLED, clientUuid }`, `TripConditionRecord { tripId, stage PRE|POST, odometerKm, fuelLevel, photoUrls[] (4 angles + odometer), damageNotes, signatureUrl? }`, `RoadsideRequest { userId, vehicleId, incidentType FLAT_TIRE|DEAD_BATTERY|OUT_OF_FUEL|OVERHEATING|NO_START|ACCIDENT|OTHER, lat, lng, address, landmarkNote, status REQUESTED|ACKNOWLEDGED|DISPATCHED|EN_ROUTE|ON_SITE|RESOLVED|CANCELLED, dispatchedToUserId?, towPartnerName?, resolutionNotes, costCentavos, timeOnSiteMin?, distanceKm? }`, `ServiceZone { name, polygon (jsonb GeoJSON), surchargeCentavosPerKm, freeRadiusKm }`.

### Task 2: Zone check (FR-076, FR-104)
`GET /trips/zone-check?lat&lng` → `{ inZone, zoneName?, surchargeCentavos }`. Pure point-in-polygon (ray casting) + haversine distance from centre for per-km surcharge — unit-tested with Zamboanga fixtures (in-city point, Vitali edge point, out-of-range point). Admin zone editor deferred to Phase 7 (A-08); seed one launch zone.

### Task 3: Trips lifecycle + assignment (FR-075, FR-077)
`POST /trips` (from booking flow — un-stub M-21: address entry + map pin, window, contact person, zone check inline with surcharge shown before confirm; consumes `PICKUP` entitlement); `POST /trips/:id/assign` (advisor picks driver from on-shift list); status transition endpoint validating the machine above; W-12 trip assignment board (unassigned column → per-driver columns, drag to assign). **Tests:** transition table; entitlement consume/overage; assignment race (two advisors → one wins).

### Task 4: Driver trip execution (F-11→F-14)
F-11 my-trips list (today, ordered by window); F-13 navigate (opens Apple/Google Maps with coords — no in-app nav); F-12 **pre-trip condition capture** — camera flow enforcing 4 exterior angles + odometer photo + fuel slider + damage notes before departure is allowed (FR-078), offline-queued; F-14 hand-over: member signs on driver's phone (`react-native-signature-canvas`) or, if not present in person, confirms from their own authenticated session (FR-079), captured at both hand-over and return (stage PRE/POST). **Tests:** capture completeness gate; offline queue of a full condition record with photos; signature upload path.

### Task 5: Live tracking (FR-080, FR-081; M-24)
Driver app: `expo-location` foreground service while trip active, position POST every 15 s → Redis (`trip:loc:{id}`, TTL 120 s) → Socket.IO `trip.location` room per trip. Member M-24: map with driver marker, name/photo/call button, status timeline; sharing stops at COMPLETED (server stops emitting; client room closed). **Tests:** location gated by trip status (no emission after completion — privacy assertion); reconnect resubscribes.

### Task 6: Driver COD at hand-over (FR-085 driver path)
F-15 collection screen (invoice lookup by trip → amount, tendered, change; requires open cash shift F-16 — reuses Phase 2 machinery; offline: receipt numbers pre-allocated per device in blocks (Architecture §7.6), payment queued via outbox `entityType: "payment_cash"`). **Tests:** offline cash record syncs exactly once; receipt numbers unique across two devices' blocks.

### Task 7: Roadside request flow (FR-031→FR-035; M-26, M-27)
Home-screen SOS button (the one bold element, always visible, eligibility pre-checked on home load — ineligible state shows FR-035 message + hotline + paid option, not a dead button). M-26: incident type chips → GPS capture with reverse-geocoded address + landmark free-text → confirm (≤3 taps to submitted). M-27: live status timeline (the 6 states), responder card when dispatched, cancel, and the hotline button persistent. `POST /roadside/requests` enforces BR-02 server-side and consumes `ROADSIDE` entitlement. **Tests:** eligibility matrix (no sub / unpaid / <30 days / quota exhausted / eligible); request-to-visible-in-queue e2e.

### Task 8: Dispatch queue + resolution (FR-036→FR-039; W-10, W-11, F-17, F-18)
W-10 `/staff/roadside`: live queue (Socket.IO + 20 s poll fallback), age-since-request timers turning amber >2 min, unacknowledged rows pulse; W-11 dispatch: assign on-shift driver or record tow partner, member auto-notified on every transition (FR-038). F-17 driver response screen (accept → EN_ROUTE → ON_SITE with one-tap transitions, offline-tolerant); F-18 advisor mobile fallback (acknowledge + dispatch from the field app). Resolution form (advisor or driver): outcome, time on site, distance, parts consumed → `costCentavos` recorded for FR-099 reporting. **Tests:** 30 s notification SLA (integration: request → advisor socket receives <5 s); full status walk e2e; resolution cost lands for Phase 7 reports.

## Exit criteria
- Book-with-pick-up on iOS: zone-checked address → advisor assigns → driver captures pre-trip condition offline → member watches the truck arrive on the map → signature at hand-over → COD collected → delivery back with POST condition record.
- SOS on iOS: eligible member reaches RESOLVED through the full state walk with live updates; ineligible member sees the non-punitive path; hotline visible throughout.
- Location sharing verifiably stops at trip completion; airplane-mode trip updates sync without duplicates.
