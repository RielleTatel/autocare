# Member App P0 Re-skin — Onboarding & Sign In

**Date:** 2026-08-29
**Source:** `autocare_secondary_screens_uiux_suggestions.md` (P0 scope)
**Status:** Approved, proceeding directly to implementation

## 1. Purpose

Bring the two first-impression screens — Onboarding and Sign In — up to the composition
quality of the existing Home screen. This is a **re-skin only**: no route changes, no prop or
callback changes, no backend work, no new functionality.

The source document is explicit that the problem is *composition and hierarchy*, not decoration.
Adding colour, gradients, glassmorphism, or decorative animation is out of scope and would miss
the point.

## 2. Constraints (non-negotiable)

Carried verbatim from the source doc's §2 and §38:

- Keep the existing colour palette, brand colours, and typography — all sourced from
  `@autocare/design-tokens` via `theme`.
- Keep existing button language (`components/Button.tsx` variants: `primary`, `secondary`,
  `deep`, `danger`, `ghost`). Do not add a variant.
- Keep the Home screen, bottom navigation, routes, and backend behaviour untouched.
- Keep every existing prop and callback signature on both screens.
- Use the existing Lucide icon system (`components/Icon.tsx`) — one icon family only, imported
  individually (the file documents that Metro will not tree-shake the 1,778-icon barrel).

## 3. Findings that shaped this design

Three things were verified against the codebase before designing, and two of them change what
the source document asks for.

### The "floating settings button" does not exist

The doc's §8 asks to remove a floating grey gear from six screens. A search across the entire
member app found no gear icon and no floating control on any screen. The only `settings`
matches are the word appearing in two code comments.

**Conclusion:** this describes the Expo development client's own shake-to-reveal dev-menu
overlay, not application code. It is already absent from release builds and cannot be removed
from application code. **No work is scoped for §8.**

### There are no illustration assets, but there is a real logo

`apps/member/assets/` contains only app icons, a splash icon, and `logo-mark.png`. There are no
illustrations.

- Sign In's branding header uses the **real** `logo-mark.png`.
- Onboarding hero visuals and any future empty-state art are **composed from Lucide icons**
  at large format inside a coloured badge — consistent with the doc's own iconography rule
  (§35) and its warning against "random illustrations".

### No Google brand glyph exists, and one will not be fabricated

The doc's §13 mockup shows a `G` mark. Lucide has no Google brand glyph. Drawing a substitute
would misrepresent a third party's brand assets. The existing `secondary` Button variant
(bordered, transparent, primary-tinted) gives the control genuine button weight, which is what
§13 actually asks for — *"should become a proper secondary button"*. **No logo is used.**

## 4. Onboarding

**File:** `features/auth/OnboardingScreen.tsx` — prop `onGetStarted` unchanged.

### Current state

Three horizontally-paged `Card`s, each containing a title and body at nearly equal weight,
vertically centred with large dead space above and below. Dots sit at the bottom, visually
detached from the content they index.

### Target composition

```
hero badge  →  heading  →  supporting text  →  progress  →  CTA
```

| Element | Treatment |
|---|---|
| Hero badge | Circular, `primaryDeep` fill, one large Lucide glyph per slide. Same frame on every slide so the set reads as one system. |
| Heading | `text("h1")`, `primaryDeep`. |
| Supporting text | `text("body")`, `inkMuted`. Clearly subordinate to the heading. |
| Progress dots | Existing dot mechanic retained; moved to sit with the copy block rather than floating at the screen bottom. |
| CTA | Existing `Button block`, unchanged copy ("Get started"). |

### Slide content

| # | Icon | Heading | Body |
|---|---|---|---|
| 1 | `car-front` | Your car, always cared for | Scheduled maintenance, service, and roadside assistance — all in one place. |
| 2 | `calendar-plus` | Stay ahead of maintenance | Know what needs attention before small issues become bigger problems. |
| 3 | `calendar-days` | Service when you need it | Book maintenance and keep track of your vehicle's service history. |

The `Card` wrapper is dropped. A card inside a full-bleed slide adds a border for no reason and
is part of why the screen reads as sparse — the slide itself is the surface.

## 5. Sign In

**File:** `features/auth/EmailAuthScreen.tsx` — props `onSignIn`, `onRegister`, `onGoogle`,
`onForgotPassword`, `error`, `notice` all unchanged. Sign-in / register mode toggle unchanged.

### Current state

`justifyContent: "center"` on the root leaves a large empty region above the form. There is no
branding. "Continue with Google" is a bare `Pressable` wrapping a `Text`, visually
indistinguishable from the "Forgot password?" link below it. The password field has no
visibility toggle.

### Target composition

```
brand  →  context  →  form  →  primary CTA  →  divider  →  Google  →  create account
```

| Element | Change |
|---|---|
| Brand header | **New.** `logo-mark.png` + "Welcome back" (h1) + "Your vehicle care, all in one place." (body/muted). Replaces dead space with content. Register mode keeps its own heading. |
| Root layout | `justifyContent: "center"` → top-aligned with deliberate padding, so the screen fills from the top rather than floating. |
| Email field | Unchanged style; gains a visible label above it for hierarchy. |
| Password field | Unchanged style; gains a visible label and a **visibility toggle** (`eye` / `eye-off`). New local state only. |
| Primary CTA | Unchanged. |
| Divider | **New.** A hairline rule with "or" — separates password auth from federated auth, which currently run together. |
| Google | `Pressable`+`Text` → `<Button variant="secondary" block>`. No brand glyph. |
| Create account | Grouped directly beneath as a deliberate secondary action rather than a floating line. |

`eye` and `eye-off` must be added to `Icon.tsx`'s `GLYPHS` map — that file requires individual
imports by design.

## 6. Testing

Both screens have existing test files that must keep passing, since behaviour is unchanged:

- `OnboardingScreen` — dot `testID`s (`dot-0`…) and `get-started` are asserted; both are retained.
- `EmailAuthScreen` — `email-input`, `password-input`, `submit`, `google`, `forgot-password`,
  `toggle-mode`, `error`, `notice` `testID`s are asserted; **all retained**.

New coverage:

| Test | Asserts |
|---|---|
| Onboarding | Each slide renders its heading; hero badge present per slide. |
| Sign In | Password visibility toggle flips `secureTextEntry`. |
| Sign In | Brand header renders in sign-in mode. |

Existing suites passing unchanged is the evidence that this is a re-skin and not a behaviour
change.

## 7. Out of scope

- §8 floating settings button — does not exist in application code (see §3).
- §36 vehicle year data inconsistency — a data bug, not a re-skin concern; the user confirmed
  functionality is already correct.
- P1 (My Bookings, Add Vehicle) and P2 (Vehicle Details, Account, shared empty/loading states)
  — separate phases, each with its own design and plan.
- Any new `Button` variant, colour token, or icon family.
