# Member App P2 Re-skin — Vehicle Details, Account & Shared States

**Date:** 2026-08-29
**Source:** `autocare_secondary_screens_uiux_suggestions.md` (P2 scope)
**Follows:** `2026-08-29-member-p0-reskin-design.md`, `2026-08-29-member-p1-reskin-design.md`
**Status:** Approved, proceeding directly to implementation

## 1. Purpose

Complete the member re-skin: Vehicle Details, Account, and the shared empty/loading states the
earlier phases built inline. Same constraints as P0 and P1 — existing palette, typography,
`Button` variants, one icon family, no route changes.

One approved behavioural change: the vehicle detail container fetches the health score so the
identity block can answer "how is this car?" (§5).

## 2. Two places the source document asks for things that do not exist

Both were verified against the code before designing.

### Tabs on Vehicle Details (doc §27)

The doc proposes `Overview | Maintenance | History`, while its own rule states *"Do not create
tabs for content that does not exist."*

Only Overview content lives on this screen — specs, odometer, a health link, subscription.
Maintenance and History are **separate screens** (`ServiceHistoryScreen`,
`RecommendationsListScreen`) reached from elsewhere in the navigator. Three tabs where two are
empty is worse than none.

**No tabs are added.** The screen is not long enough to need them once identity is consolidated.

### The Account settings list (doc §29)

The doc proposes Notifications, Units, Appearance, Help center, Contact support, and Terms of
service. None of these exist as routes or features. The app has exactly four rows:
Personal details, Subscription details, Invoices & receipts, Privacy & data.

Adding six rows that navigate nowhere is new functionality — and dead links read as more broken
than an ungrouped list. **The four existing rows are grouped; none are invented.**

## 3. Shared components

Built first, because both screens consume them.

### `EmptyState` — optional hero slot

`components/EmptyState.tsx` gains an optional `icon?: IconName`. When supplied it renders the
glyph in a circular `chassis` badge above the title — the same composition P1 built inline for
the bookings empty state, now shared rather than duplicated.

Existing call sites pass no `icon` and are unaffected.

### `Skeleton` — new

`components/Skeleton.tsx`. Layout-aware loading blocks (doc §31): rounded `line`-coloured bars
at caller-specified widths, so a loading screen resembles the screen that is coming rather than
a blank canvas or a spinner.

```
<Skeleton.Line width="60%" />
<Skeleton.Card lines={3} />
```

No animation. Motion here would be decoration on a state the user should leave quickly, and the
doc explicitly warns against decorative animation (§32).

## 4. Vehicle Details

**File:** `features/vehicles/VehicleDetailScreen.tsx`

### Current state

Identity is scattered across the screen: a `Plate` chip top-left, the vehicle name below it, the
odometer buried in a spec row two-thirds down, and health in a card at the very bottom. Doc §28
asks that a user not have to scan multiple cards to know which vehicle they are looking at.

When the vehicle has no photo, the screen opens with a **200px flat grey block** — the single
clearest instance of the "unfinished" quality the whole document is about.

### Target

| Element | Change |
|---|---|
| Photo / no-photo | A photo still renders full-bleed. Without one, a `chassis` panel with a centred `car-front` glyph and "No photo yet" replaces the grey slab — an intentional absence rather than a void. |
| Identity block | One `Card` directly under the image: `Plate` · `{year} {make} {model}` · odometer · health band. Everything needed to recognise the car, in one glance. |
| Odometer | Still inline-editable, unchanged behaviour and testIDs, but presented within identity rather than as a spec row. |
| Specs | Fuel / transmission / variant / VIN move into a labelled `Card` ("Specifications") instead of a bare bordered list. |
| Health | With a score: band chip + value in the identity block, and the card below becomes "View full report →". Without: the existing "Coming with your first inspection" copy is kept. |
| Overflow menu | `⋯` glyph text → `Icon`. Archive flow unchanged. |

## 5. The one behavioural change

`VehicleDetailContainer` in `app/RootNavigator.tsx` gains
`healthScoreApi.getScore(vehicle.id)`, mapped to a new optional
`health?: { score: number; band: Band }` prop — the same shape `HomeScreen` already receives.

The call is `.catch`'d: a vehicle with no inspection yet legitimately 404s, and that must render
"Coming with your first inspection", not an error.

## 6. Account

**File:** `features/account/AccountScreen.tsx`

The screen is already well composed above the fold — identity, plan card with `StatusPill`,
entitlement gauges, plan cards. The weak point is the tail: four settings rows in one
undifferentiated stack, then Sign out.

| Element | Change |
|---|---|
| Settings grouping | Three labelled groups — **Account** (personal details, subscription details) · **Billing** (invoices & receipts) · **Legal & data** (privacy & data). Each group is a `Card`; the heading is a muted uppercase eyebrow, matching the section treatment P1 introduced on Add Vehicle. |
| Sign out | Stays separate and `danger`-tinted, now inside its own bordered row so it reads as a deliberate terminal action rather than trailing text. |

No row is added, removed, or re-pointed.

## 7. Testing

Existing suites must pass unchanged:

- `VehicleDetailScreen` — `odometer-input`, `odometer-save`, `odometer-update`,
  `odometer-justification`, `odometer-retry`, `odometer-error`, `overflow-menu`,
  `archive-action`, `archive-cancel`, `archive-confirm`, `view-health-score`,
  `manage-subscription` all retained.
- `AccountScreen` — `account-screen`, `status-banner`, `no-subscription`, `next-billing`,
  `lockin-countdown`, `plan-{id}`, `row-personal`, `row-subscription`, `row-invoices`,
  `row-privacy`, `sign-out` all retained.

New coverage:

| Test | Asserts |
|---|---|
| `EmptyState` | Renders the hero glyph when `icon` is passed, and omits it otherwise. |
| `Skeleton` | Renders the requested number of lines. |
| Vehicle Details | Identity block shows plate, name and odometer together. |
| Vehicle Details | Health band renders when `health` is supplied; the "first inspection" copy shows when it is not. |
| Vehicle Details | No-photo state renders the placeholder, not a bare block. |
| Account | Settings rows render under their group headings. |

## 8. Out of scope

- Tabs on Vehicle Details (§2).
- Any settings row that does not already have a route (§2).
- Doc §36 vehicle year data inconsistency — a data bug; functionality confirmed correct.
- Loading-state adoption across every screen. `Skeleton` is built and unit-tested here; wiring
  it into each container is follow-up work, not part of this re-skin.
