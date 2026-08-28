# Field App Design-System Fidelity — Executed

**Date:** 2026-08-28
**Branch:** `field-design-system-fidelity` (13 commits, NOT merged/pushed)
**Spec:** `docs/superpowers/specs/2026-08-28-field-design-system-fidelity-design.md`
**Plan:** `docs/superpowers/plans/2026-08-28-field-design-system-fidelity.md`

## Why

A 2026-08-28 cross-check of `AutoCare+ Design System/AutoCare+ Field App.html` against
`apps/field/src` found **zero design-system adoption** — the 2026-08-25 incorporation
program and the 2026-08-27 member fidelity pass both explicitly excluded field.

## Root cause fixed

`apps/field/src/theme/index.ts` named `BarlowSemiCondensed_600SemiBold` and
`IBMPlexMono_500Medium` as font families, but nothing registered them — no
`expo-font`, no `useFonts()`. Every heading and every mono plate/code silently fell
back to the system face. Identical defect to the one found in `apps/member` on
2026-08-27. Fixed by registering the five faces (Barlow 600, Inter 400/500/600, Plex
Mono 500) and gating `App.tsx` on `useFonts`. `theme.text()` no longer emits
`fontWeight` (RN mis-synthesises it against a named family). Guarded by
`theme/theme.test.ts`, which asserts every type-scale role resolves to a registered
family and that `fontWeight` is never present.

## Delivered

- **Icon layer** — `components/Icon.tsx` on `lucide-react-native`, glyphs imported
  individually (Metro doesn't tree-shake the barrel). Retired all 14 emoji across
  StaffHome (now deleted), PointEntry, ReviewSubmit, PhotoAnnotate, SyncQueue, and
  WasteEntry.
- **Primitive layer**, ported from `apps/member/src/components` and re-tuned to the
  56dp field target / ×1.125 scale: `Card`, `Button` (no compact size — every field
  button is 56dp), `StatusPill`, `Plate`, `EmptyState`, `FormField`, plus four
  field-only primitives the mockup needed and member has no counterpart for:
  `FieldNav` (the 52dp back/title bar every screen was missing), `StatusChoice`,
  `StatusChip` (+ shared `STATUS_LABELS`/`statusColor`), `ScoreGauge` (extracted from
  `ScoreResultScreen`, correcting a hardcoded `stroke=20` to the `borders.gaugeStroke`
  token value of 18).
- **New `TaskListScreen`** replaces `StaffHomeScreen` as the Home route — today's work
  as cards (mono time, `Plate`, `StatusPill`, service, vehicle · WO id), reading
  `GET /scheduling/board` (MECHANIC is already in `STAFF_ROLES`, so no API change was
  needed) and caching the response via the existing kv store so an offline mechanic
  still sees the morning's list behind a "last known" marker.
- **All nine screens re-skinned**: CategoryNav (FieldNav, progress bar, Filipino
  sub-labels, mono counts, `borders.accentRow` accent), PointEntry (StatusChoice/
  StatusChip, photo-attached confirmation card), ReviewSubmit (every point listed with
  its measurement and threshold, not just problems; vehicle card; outbox line),
  ScoreResult (ScoreGauge, confidence indicator, averaged-vs-capped explanation with
  real numbers, per-recommendation cost + severity), SyncQueue (flattened to Card +
  StatusPill rows, empty state), WasteEntry/PhotoAnnotate/StaffLogin (icons + shared
  primitives).
- **`FormField` gained `secureTextEntry` and `errorTestID`** while porting
  `StaffLoginScreen` onto it — needed for password masking and to preserve the
  `staff-login-error` testID other code may rely on.

## Verify

`apps/field`: `pnpm test` → **80/80 passing** (33 original + 47 new), `pnpm typecheck`
clean. All 10 feature/shared screens now import at least one shared primitive (was 0).
No emoji remain in any `.tsx` file.

**Not run this session:** the full `pnpm turbo run typecheck lint test` monorepo gate
— the user flagged an API-side problem on their machine mid-run (the `apps/api` test
target was hanging past its normal runtime), so the run was stopped rather than
diagnosed as part of this pass. That hang is unrelated to any change in this branch
(nothing here touches `apps/api`, and `apps/field`'s own suite is fully green in
isolation, confirmed twice). Owed: re-run the full gate once the API-side issue is
resolved, to confirm `apps/member` and `apps/web` are still unaffected.

## Deviations (flagged in the spec, carried through as designed)

1. **Inter for body text**, not the design-system readme's native "system stack" —
   matches the mockup and the member app; approved 2026-08-28.
2. **Band-coloured status chips**, not generic `StatusPill` lifecycle tones — so
   CRITICAL and ATTENTION don't collapse into one "danger" (Principle 1: band colours
   are product data).
3. **Day-scoped task list**, not mechanic-scoped — every mechanic sees the whole day.
   Closing this needs an `assignedMechanicId` on `Appointment` and a
   `GET /field/tasks` endpoint; recorded as owed, not built here.

## Owed (unrunnable here / out of scope)

- On-device Expo custom dev client verification — never run headless here, same as
  every prior pass.
- The full monorepo `turbo` gate re-run (see above).
- `assignedMechanicId` + `GET /field/tasks` for a true mechanic-scoped task list.
- `apps/web` still has its own, separate design-system gap (missing `TopBar`, unused
  component library, absent dashboard panels) — documented in the 2026-08-28
  cross-check, not touched by this pass.
- Branch is **not merged or pushed** — sits on `field-design-system-fidelity`, 13
  commits ahead, awaiting the user's decision on how to land it.
