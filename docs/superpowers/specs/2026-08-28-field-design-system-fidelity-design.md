# AutoCare+ Field App Design-System Fidelity — Design

**Date:** 2026-08-28
**Status:** Approved for planning
**Scope:** Register the three brand typefaces in `apps/field`, replace emoji with the
lucide icon set, introduce a React Native primitive layer, and re-skin all nine field
screens to `AutoCare+ Design System/AutoCare+ Field App.html`.

## Context

The 2026-08-25 design-system incorporation explicitly listed `apps/field` as a
non-goal, and the 2026-08-27 member fidelity pass did not touch it either. A
cross-check of the extracted Field App mockup against `apps/field/src` on 2026-08-28
found **zero design-system adoption** in the app.

The mockup bundle is not readable HTML — it is a gzip+base64 resource map on line 372
of the `.html` file, with the real screen source in three `text/babel` resources. The
reference for this work is the decoded bundle: `TaskListScreen` and `CategoryNavScreen`
in one resource, `PointEntryScreen` / `ReviewScreen` / `ScoreResultScreen` /
`SyncQueueScreen` in another, and the shared `FieldNav` + fixture data in a third.

### The dominant defect

`apps/field/src/theme/index.ts:4` names `BarlowSemiCondensed_600SemiBold` and
`IBMPlexMono_500Medium`, but `apps/field/package.json` declares no `expo-font` and no
`@expo-google-fonts/*`, and `App.tsx` never calls `useFonts()`. **Every heading and
every mono plate or code silently falls back to the system face.**

This is the identical root cause found and fixed in `apps/member` on 2026-08-27. It is
not a layout problem, and no amount of re-skinning fixes it. It is fixed first, and
guarded by a test, because it is the class of bug that silently reappears.

`theme.text()` also still emits `fontWeight` (line 18). React Native ignores
`fontWeight` on iOS when an exact family is named and mis-synthesises it on Android, so
the member pass removed it. Field must do the same.

### Current styling patterns

- **No primitives exist.** `apps/field/src/components/` is absent. All nine screens
  hand-roll inline `View` / `Pressable` / `Text` against the `fieldTheme` object.
- **Emoji stand in for icons** — 14 of them across StaffHome, PointEntry,
  ReviewSubmit, PhotoAnnotate, SyncQueue, WasteEntry and CategoryNav.
- **No shared chrome.** `App.tsx` sets `headerShown: false`; CategoryNav and SyncQueue
  each invent a `primaryDeep` block header, and PointEntry, ReviewSubmit and
  ScoreResult have no header or back affordance at all.

### What is already correct

The ×1.125 field type scale in `theme.text()` resolves to exactly the sizes the mockup
hardcodes (h1 32, h2 25, body 18, label 15). The scale is kept as-is. The
`ScoreResultScreen` gauge geometry (240px semicircle, member-matched arc math) is also
correct and is extracted rather than rewritten.

## Non-goals

- **`apps/web`.** The staff console's missing `TopBar`, unadopted component library and
  absent dashboard panels are documented in the same 2026-08-28 cross-check and are a
  separate pass.
- **A mechanic-scoped tasks endpoint.** See "Task list data source" below.
- **Extracting a shared `@autocare/rn-ui` package.** Considered and deferred; see
  "Approach".
- **Roadside screens (M-26/27).** Phase 6 work; they do not exist in either app.

## Approach

Three options were weighed for getting primitives into field:

| | Approach | Verdict |
|---|---|---|
| A | Port member's components into `apps/field/src/components/`, re-tuned to 56dp targets and the ×1.125 scale | **Chosen** |
| B | Extract a shared `@autocare/rn-ui` consumed by member and field | Deferred |
| C | Fonts and icons only; no primitive layer | Rejected |

**A is chosen.** It carries zero risk to member's 150 green tests, and it lets field's
components own their field sizing rather than bolting a `size="field"` variant onto
every member component. Because the component APIs come out identical to member's,
extracting B later is mechanical rather than a redesign.

**C is rejected** because it fixes the fonts but leaves every screen hand-rolled, so
the next screen written drifts again — which is how field reached zero adoption in the
first place.

## Design

### 1. Font registration

Add `expo-font` and `@expo-google-fonts/{barlow-semi-condensed,inter,ibm-plex-mono}`.
Register five faces, matching member's set exactly:

| Role | Family | Weights |
|---|---|---|
| display | Barlow Semi Condensed | 600 |
| body | Inter | 400, 500, 600 |
| mono | IBM Plex Mono | 500 |

`theme.text(role, weight?)` resolves to an exact registered family name and **never
returns `fontWeight`**. `App.tsx` gates render on `useFonts` and shows the existing
`Splash` until the faces resolve.

**Deviation, carried from member and approved 2026-08-28:** the design-system readme
says native "substitutes the system stack" for body, but Inter is loaded so field
matches both the mockup and the member app. Revert by setting the body family prefix to
`"System"` in `theme/index.ts`.

### 2. Icons

`components/Icon.tsx` wraps `lucide-react-native`, keyed by the design system's kebab
names. Glyphs are imported **individually** — Metro does not tree-shake the 1,778-icon
barrel, a gotcha recorded during the member pass.

Icons the mockup requires: `wrench`, `refresh-cw`, `chevron-right`, `chevron-left`,
`clipboard-check`, `camera`, `image`. Sync-queue and waste entity glyphs replace the
remaining emoji.

### 3. Primitive layer

New `apps/field/src/components/`, ported from `apps/member/src/components/` and
re-tuned to `targets.fieldMinDp` (56) and the ×1.125 scale:

`Card` (pad / accent / interactive) · `Button` (primary, secondary, danger; field size
default) · `Plate` · `StatusPill` (tone system) · `Icon` · `EmptyState` · `FormField`

Four are field-only, because the mockup needs them and member has no counterpart:

- **`FieldNav`** — the 52dp surface bar with a primary `chevron-left` Back, an h2
  title, and an optional right slot. Every screen in the mockup has one; no screen in
  the app does.
- **`StatusChoice`** — the stacked 56dp status rows on PointEntry.
- **`StatusChip`** — point status rendered in its band colour.
- **`ScoreGauge`** — extracted from `ScoreResultScreen`, with the hardcoded
  `stroke = 20` corrected to the `--ac-gauge-stroke` token value of 18.

`SyncBanner` is upgraded in place: it becomes pressable and routes to the sync queue,
as the mockup has it.

### 4. Screens

All nine, in dependency order:

| Screen | Change |
|---|---|
| `TaskListScreen` | **New.** Today's work as cards: mono time, `Plate`, `StatusPill`, service h2, vehicle · WO id. Becomes the Home route. |
| `StaffHomeScreen` | Retired — `TaskListScreen` replaces it. Its two actions move to the task list's footer. |
| `CategoryNavScreen` | Drop the dark header for `FieldNav`; add the 8px progress bar, Filipino sub-labels, mono `done/total` that turns `band-excellent` when complete, and chevrons. Left accent edge uses the 5px `--ac-border-accent-row` token, not the current hardcoded 6. |
| `PointEntryScreen` | `FieldNav`, `StatusChoice`, `StatusChip`, and the "1 photo attached" confirmation card. |
| `ReviewSubmitScreen` | Add the vehicle card, the full per-point list with measured values and thresholds in mono, the accent summary card for what is missing, and the "submits to the outbox" line. |
| `ScoreResultScreen` | `ScoreGauge` at stroke 18 with its confidence indicator; the "averaged X · capped at Y" explanation; recommendation cards with peso estimates and `StatusChip`; "Back to today's tasks". |
| `SyncQueueScreen` | Flatten to `Card` + `StatusPill` rows; icons replace emoji; "Retry now" becomes a secondary `Button`. |
| `WasteEntryScreen` | Icons replace the five emoji; `FormField` for entry. |
| `PhotoAnnotateScreen`, `StaffLoginScreen` | Icons and `Button` / `FormField` primitives. |

### 5. Task list data source

`GET /scheduling/board?from=<today>&to=<today>`, already shipped in Phase 3 and used by
the web board. `MECHANIC` is a member of `STAFF_ROLES`
(`apps/api/src/modules/scheduling/scheduling-config.service.ts`), so the endpoint is
callable from field with no API change.

`features/tasks/tasksApi.ts` fetches it; the last good response caches into the existing
kv store, following the `checklistCache.ts` precedent, so an offline mechanic still sees
the morning's list behind a "last known" marker. `EmptyState` renders when the day is
clear.

**Deviation:** the board is day-scoped, not mechanic-scoped — every mechanic sees the
whole day, where the mockup's header implies "Mechanic · J. Cruz" sees only their own.
Closing this needs an `assignedMechanicId` on `Appointment` plus a
`GET /field/tasks` endpoint, which is backend work outside a fidelity pass. Recorded as
owed.

### 6. Error handling

Task list failures degrade rather than block: a network error with a warm cache renders
the cached list plus the staleness marker; a network error with a cold cache renders
`EmptyState` with a retry action. Neither blocks the inspection flow, which is
offline-first and already independent of the board.

### 7. Testing

TDD throughout, mirroring member's suite:

- A test per primitive (`Button`, `Card`, `StatusPill`, `Plate`, `EmptyState`,
  `FormField`, `Icon`, `FieldNav`, `StatusChoice`, `StatusChip`, `ScoreGauge`).
- `TaskListScreen` across loading, loaded, offline-cached and empty.
- **A theme guard** asserting `text()` returns a registered family for every role and
  never returns `fontWeight`. This is the regression test for the defect that motivated
  the whole pass.
- The existing 33 field tests stay green.

Verification gate: `pnpm turbo run typecheck lint test` across all workspaces.

## Deviations from the mockup, flagged

1. **Inter for body** rather than the readme's native system stack (approved).
2. **Band-coloured status chips** rather than the generic `StatusPill` lifecycle tones,
   so CRITICAL and ATTENTION do not collapse into a single "danger" — the same call
   made in the member pass, under design-system Principle 1 (band colours are product
   data).
3. **Day-scoped task list**, per section 5.

## Risks

- **`pnpm --filter field add` pruned `apps/field`'s `@testing-library/react-native`
  store link** during the member pass and broke its typecheck. Run a root
  `pnpm install` after any filtered add and re-verify every workspace typechecks.
- **jest-expo's preset only transforms `\.[jt]sx?`**, so lucide's `.mjs` entry needs
  the preset transform extended in `apps/field/jest.config.js` — the same edit member
  needed.
- **On-device verification is not runnable here.** Expo custom dev client screenshots
  remain owed, as they do for member.
