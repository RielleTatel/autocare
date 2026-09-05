# Member App P1 Re-skin — My Bookings & Add Vehicle

**Date:** 2026-08-29
**Source:** `autocare_secondary_screens_uiux_suggestions.md` (P1 scope)
**Follows:** `2026-08-29-member-p0-reskin-design.md`
**Status:** Approved, proceeding directly to implementation

## 1. Purpose

Bring My Bookings and Add Vehicle up to the composition quality of Home, continuing the P0 work.
Composition and hierarchy only — the same constraints as P0 apply verbatim (existing palette,
typography, `Button` variants, Lucide icon family, no new tokens, no route changes).

One deliberate exception is scoped and approved: the bookings container gains a single
`GET /vehicles` call so a booking can name its vehicle. See §4.

## 2. My Bookings

**File:** `features/booking/BookingsListScreen.tsx`

### Current state

The row renders the service name in `body`, then date and status concatenated into one muted
`label` line (`{manila(start)} · {status}`). The vehicle is never shown, despite `vehicleId`
being present on every appointment. The empty state is a bare `<Text>Nothing scheduled.</Text>`
followed by the rest of an empty screen. "Book new" and "Cancel" are both plain text
`Pressable`s.

### Target

| Element | Change |
|---|---|
| Empty state | `EmptyState` with a `calendar-days` hero badge, "No upcoming services", supporting line, and a **Book a service** primary CTA. An empty screen becomes an invitation (doc §16, §30). |
| Card hierarchy | Service name `h2` · date/time `body` in `ink` · vehicle `label` muted · status as `StatusPill`. Four levels, not one flat line (doc §18). |
| Status | Raw text → `StatusPill`. `BOOKED`/`CONFIRMED` info, `IN_PROGRESS` warn, `COMPLETED` success, `CANCELLED` neutral, `NO_SHOW` danger — the same mapping the staff web board already uses (doc §19). |
| Vehicle | New optional `vehicleLabels?: Record<string, string>` prop, mirroring the existing `serviceNames` prop exactly. |
| Header action | "Book new" text link → `Button size="member" variant="secondary"`. |
| Cancel | Stays a text action, but tinted `danger` and given its own row so it reads as deliberate rather than as part of the card's body copy. |

### Tabs: deliberately not added

Doc §20 says *"Use tabs only if both sections contain meaningful content."* A member's booking
list is typically one or two rows. Tabs would add a tap to reach content that already fits on
one screen. The existing "Upcoming" / "Past" headings are kept, with "Past" rendered only when
non-empty — which the current code already does correctly.

## 3. Add Vehicle

**File:** `features/vehicles/AddVehicleScreen.tsx`

### Current state

Seven fields (plate, make, model, year, odometer, fuel, transmission) rendered flat, each with
identical `FieldLabel` + input weight. A "More details" toggle already exists and is a sound
foundation. The `h1` sits alone with no supporting line.

### Target

| Element | Change |
|---|---|
| Header | `h1` gains "Tell us about your car." beneath it. |
| Section grouping | Three labelled groups — **Vehicle** (plate, make, model, year), **Usage** (odometer, fuel type), **Transmission** — each inside a `Card` with a section eyebrow. The grouping encodes what the fields *are* (doc §22). |
| Live preview | New `VehiclePreview` component: `Plate` + "{year} {make} {model}" + odometer, updating as the user types. Renders once **plate and make** are both non-empty, so it rewards progress instead of showing an empty frame (doc §23). |
| Progressive disclosure | Existing "More details" retained, restyled as an intentional expandable row with a chevron that reflects state (doc §24). |
| CTA | Unchanged copy — "Add vehicle" (doc §25 explicitly warns against changing terminology). |

### No vehicle image

Doc §23's mockup implies a vehicle photograph. The app has no vehicle imagery and no source for
it; fabricating one would be decoration standing in for content. The preview is built from
`Plate` and typography, which is honest and still reads as automotive.

## 4. The one behavioural change

`BookingsContainer` in `app/RootNavigator.tsx` gains `api.get<Vehicle[]>("/vehicles")` alongside
its existing appointments and service-types fetches, mapped to `vehicleLabels`.

This is read-only display of data that already exists, using a call already made twice elsewhere
in the same file. The prop is optional, so a failed vehicles fetch degrades to the current
behaviour (no vehicle line) rather than breaking the screen.

## 5. Testing

Existing suites must pass unchanged — that is the evidence this is a re-skin:

- `BookingsListScreen` — `bookings-list-screen`, `appt-{id}`, `cancel-{id}`, `book-new`,
  `pending-approval` testIDs are all retained.
- `AddVehicleScreen` — `field-{name}`, `field-{name}-{option}`, `more-details-toggle`,
  `form-error`, `submit` testIDs are all retained.

New coverage:

| Test | Asserts |
|---|---|
| Bookings | Empty state renders with its CTA when nothing is upcoming. |
| Bookings | A row shows service, vehicle label, and a status pill. |
| Bookings | Vehicle line is absent when `vehicleLabels` is not supplied. |
| Add Vehicle | Preview is hidden until plate and make are both entered. |
| Add Vehicle | Preview reflects typed values. |

## 6. Out of scope

- Doc §36 (2019 vs 2020 vehicle year inconsistency) — a data bug, not composition. The user
  confirmed functionality is correct.
- P2: Vehicle Details, Account, shared empty/loading state variants.
- Tabs on bookings (see §2).
- Any vehicle imagery, new token, new `Button` variant, or second icon family.
