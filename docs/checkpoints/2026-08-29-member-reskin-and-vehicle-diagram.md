# Progress Update — Vehicle Diagram, Member Re-skin & Scheduling Fixes

**Date:** 2026-08-29
**Branch:** `feat-2d-vehicle-diagram` (35 commits ahead of `main`; 30 from this session, branched at `de7e114`. **Not merged, not pushed.**)
**Status:** All work builds and passes. Nothing is deployed.

---

## Summary for the client

Three streams of work landed this session:

1. **The 2D vehicle diagram (FR-116 / FR-117)** — the deferred v1.1 feature is now built end to end, from database through to the member app.
2. **The member app re-skin** — all seven screens from the UI/UX brief, delivered in three phases.
3. **Scheduling fixes** — several defects that made booking appear broken were traced and fixed, including two that had been silently wrong for some time.

Everything is on a feature branch. **No changes have been merged to `main` or deployed.**

---

## Quality gates

| Package | Tests | Notes |
|---|---|---|
| `contracts` | 35 passing | |
| `scoring` | 69 passing | Includes the 37-test golden suite — **scores are byte-identical** to before this work (NFR-055) |
| `member` | 223 passing | Up from 183 at session start |
| `field` | 85 passing | |
| `web` | 83 passing | |
| **Typecheck** | **8/8 packages clean** | |

The golden-suite result matters most: it is the evidence that none of this work changed a single Vehicle Health Score.

---

## 1. The 2D vehicle diagram

The roadmap deferred this to v1.1 and recorded that the groundwork was "reserved so v1.1 is cheap."

**That groundwork did not exist.** The `checklist_points.diagram_zone_id` field the documentation describes as reserved had never been added. Building it was part of this work, not a precondition of it.

### What was built

| Layer | Change |
|---|---|
| Contracts | `DiagramZone` vocabulary — 14 semantic zones |
| Database | `diagram_zone_id` column (nullable, additive) + migration |
| Config | All **50** checklist points assigned a zone |
| API | `diagramZone` returned on inspection results |
| Member app | Tappable, colour-coded car diagram + zone detail sheet, behind a Diagram/List toggle |

### Two decisions worth recording

**No library was adopted.** A survey found none exists: the interactive-zone libraries are React DOM only, the sole React Native option is abandoned and pins React Native 0.59 (the app is on 0.86), and no npm package supplies vehicle geometry. `react-native-svg` was already a dependency and covers the interaction.

**Four of the 50 checklist points are deliberately unmapped** — `BRAKE_DISC_CONDITION`, `TYRE_PRESSURE_DEV`, `WHEEL_CONDITION`, `HORN`. Their physical position is genuinely ambiguous, and inventing one would fabricate precision on a screen members use for safety decisions. They remain fully visible in list view; the diagram is never the only route to a finding.

### Note on positional accuracy

Only tyre tread carries true per-corner data. Brake pads are per-axle; the other 44 points are vehicle-level. The diagram is therefore honest rather than precise: suspension tints all four corners because that is what the data supports.

---

## 2. Member app re-skin

Delivered against the supplied UI/UX brief in the brief's own priority order.

| Phase | Screens | Outcome |
|---|---|---|
| **P0** | Onboarding, Sign In | Both now open the way Home does — logo mark, display heading, muted subline. Sign In gained a password reveal, a real Google button, and field labels. |
| **P1** | My Bookings, Add Vehicle | Booking rows gained hierarchy and status pills; the empty state became an invitation. Add Vehicle grouped into sections with a live vehicle preview. |
| **P2** | Vehicle Details, Account, shared states | Vehicle identity consolidated into one card; Account settings grouped. Shared `EmptyState` and `Skeleton` components introduced. |

### Three items in the brief were not built, deliberately

Each was verified against the code first.

1. **The "floating settings button"** the brief asks to remove from six screens **does not exist in the application.** It is the Expo development client's own overlay — absent from release builds, and not removable from app code.

2. **Tabs on Vehicle Details** (`Overview | Maintenance | History`) were not added. The brief's own rule is *"do not create tabs for content that does not exist"* — Maintenance and History are separate screens, so two of the three tabs would have been empty.

3. **Six proposed Account settings rows** (Notifications, Units, Appearance, Help centre, Contact support, Terms) have no routes. Links that navigate nowhere read as more broken than an ungrouped list. The four rows that exist were grouped instead.

---

## 3. Scheduling and booking fixes

This is where the most consequential defects were found.

### Booking showed no available times

Three compounding causes, all now fixed:

- **Staff could not see the shop's own fleet.** `GET /vehicles` scoped every role to vehicles they personally own. A mechanic owns none, so the field app's inspection vehicle picker was always empty. Staff now see the active fleet.
- **Operating hours were write-only.** The capacity settings screen could set a day's hours but never showed what any day was currently set to. Four of seven weekdays had no hours configured — the system read that as *closed*, correctly, but nothing on screen said so. All seven days are now listed, with closed days stating what that means.
- **Availability requires rostered staff, not just opening hours.** The capacity engine offers a slot only where a qualified mechanic's shift covers it. With no shifts on current dates, the shop was open and unbookable. Shifts have been seeded for the next 30 days.

### The time picker showed 188 undated slots

The API returns a rolling two-week window in one array; the screen rendered it flat. `09:00` appeared fourteen times with nothing to distinguish the days, which read as duplicated data. Times are now grouped behind a date strip, split into morning / afternoon / evening, with the vehicle and service kept in view.

### Staff schedule had no view of availability

The advisor board only ever showed booked appointments — an hour with nothing booked produced no row, so the shape of the day was invisible. A bay-by-time grid was added alongside the list view.

### A flaky end-to-end test was made deterministic

`scheduling.e2e` asserted its own bay appeared first in results, but ties break on random UUIDs, so it passed only by luck — and degraded as fixture data accumulated. Scoping its fixture to a unique skill made it hermetic.

---

## 4. Also fixed

- **Field app inspection** — a mechanic inside a checklist point had no way back to the category list (the component supported it; the screen never passed the handler). Progress is now visible during capture.
- **Safe areas** — the app had no `SafeAreaProvider` at all, so content sat under the status bar. This also meant the bottom tab bar had been silently ignoring the home indicator.
- **App icon** — was still the Expo placeholder, including a construction-grid image configured as the Android icon background. Replaced with the AutoCare mark, recomposed full-bleed for both platforms.

---

## Open items

Nothing here is blocking, but each is a known gap.

| Item | Notes |
|---|---|
| **Authorisation split** | Mechanics can currently write capacity config — bays, service types, prices, operating hours, shifts. They need only the task board. **This should be closed before production.** |
| **Shift roster UI** | Rostering staff has no interface. Needs two API endpoints (list shifts, list staff) plus a screen. Design not yet started. |
| **Inspection history** | Technicians cannot view a vehicle's past inspections; every inspection starts blank with no visibility of prior findings. No API endpoint exists for this. |
| **Uncommitted field-app work** | Several field changes remain uncommitted in the working tree. |
| **App icon rebuild** | The icon is native configuration and needs an EAS build to appear on device. All other work is JavaScript and needs only a Metro restart. |
| **Shared test database** | The end-to-end suites run against the shared development database and interfere with one another. Individual suites pass; the full run does not. Pre-existing. |

---

## Notes for whoever picks this up

**Seeded shifts affect the test suite.** The 30 days of staff shifts that make booking work also change the numbers two capacity tests assert against. Booking demos and a fully green end-to-end run are currently mutually exclusive on this database.

**The checklist seed short-circuits.** `seedChecklist` returns early when its version already exists, so editing `seed-config.ts` will not update an already-seeded checklist. The diagram zones needed a deliberate backfill for this reason. This is easy to miss.

**Design specifications** for each phase are in `docs/superpowers/specs/`:
- `2026-08-28-2d-vehicle-diagram-design.md`
- `2026-08-29-member-p0-reskin-design.md`
- `2026-08-29-member-p1-reskin-design.md`
- `2026-08-29-member-p2-reskin-design.md`

Setup, ports, test accounts and troubleshooting are documented in `README.md`.
