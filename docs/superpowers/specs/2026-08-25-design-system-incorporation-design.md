# AutoCare+ Design System Incorporation — Design

**Date:** 2026-08-25
**Status:** Approved for planning
**Scope:** Install the design-system skill, expand the shared token package, port the
component library into `apps/web`, add React Native primitives to `apps/member`, and
re-skin flagship screens on both surfaces to the design-system grammar.

## Context

The `AutoCare+ Design System/` folder (currently untracked at repo root) is a
**recreation and codification** of the design language that already lives in the repo.
Its own readme is explicit: every token value was read out of
`packages/design-tokens/src/tokens.ts` — the declared source of truth — plus the four
client apps and `docs/design-system.html`.

Consequences that shape this design:

- **Token *values* already match the repo.** Colors, band scale, font stacks, type
  scale, spacing, radii, and targets in `AutoCare+ Design System/tokens/*.css` are the
  same values already modeled (fully or partially) in `tokens.ts`. We do **not** fork
  those CSS files into the app.
- **What is genuinely new** in the folder: a web React component library
  (`components/*.jsx` + `.prompt.md` + `.d.ts`), HTML guideline cards, per-surface
  `ui_kits` screen mockups, logo assets, a **richer CSS-var set** (spacing, elevation,
  motion, targets, and a semantic-alias layer) that the shared package does not yet
  emit, and a `user-invocable` Claude skill (`SKILL.md`).

### Current styling patterns (must be followed)

- **Member (`apps/member`, React Native / Expo):** screens hand-write `Pressable`
  buttons, cards, and pills inline against a shared `theme` object
  (`apps/member/src/theme/index.ts`) built from `@autocare/design-tokens`. **No shared
  RN primitives exist.**
- **Web (`apps/web`, Next.js + Tailwind):** pages hand-write Tailwind classes
  (`bg-chassis`, `text-ink`, `rounded-sm`, `border-line`) resolved through the
  `tailwindPreset` from `@autocare/design-tokens`. **No shared components exist.** Fonts
  are wired via `next/font` in `app/layout.tsx`.
- **Design-system `.jsx`** are DOM + inline-style + CSS-var components — a *different*
  idiom from the Tailwind-first web app. They are the **reference contract**, not the
  shipped code.

### Non-goals

- Re-skinning `apps/field` (React Native). Out of scope this program; the same tokens
  will apply when it is done later.
- Full 92-screen conversion. Depth is **foundation + flagship screens**; the remaining
  screens follow later using the same primitives.
- Adopting the logo amber as a UI accent (readme Principle 1 forbids it — too close to
  the protected FAIR band token).

## Principles carried from the design system

1. **Band colors are product data, not decoration** — the five VHS band colors appear
   only when they mean a score or inspection status. Never on buttons, accents, or
   behind headings.
2. **One bold element per screen.**
3. **Built for gloves and sunlight** — the field scale (×1.125, 56dp) is preserved in
   tokens even though field is not re-skinned here.
4. **Bilingual by design** — layouts tolerate ~30% text expansion.
5. **The UI must answer "why?"** — a score is never shown without its detractors.

## Architecture

Single source of truth stays `packages/design-tokens/src/tokens.ts`. Everything is
**generated outward** from it; the design-system `.css` files remain reference-only
inside the skill folder and are asserted equal to generated output by a test.

```
packages/design-tokens/src/tokens.ts   (source of truth: values + semantic model)
   ├── toCssVars()      → full CSS-var set  → injected into apps/web globals.css
   ├── tailwindPreset   → colors/spacing/radii/elevation/fonts → apps/web
   └── theme (RN)       → apps/member/src/theme consumes tokens directly

apps/web/components/*        (Tailwind + token React/TS components)
apps/member/src/components/* (React Native primitives on the theme)

.claude/skills/autocare-plus-design/   (the committed home of the DS folder + skill)
```

## Sub-projects (sequenced; each becomes a plan phase)

### 1. Skill install + commit folder
- Move `AutoCare+ Design System/` → `.claude/skills/autocare-plus-design/` as its single
  committed home (it is currently untracked). No second copy under `docs/` (avoids
  drift). `SKILL.md` is already `user-invocable`, so `/autocare-plus-design` works in
  future sessions and the guidelines/ui_kits travel with it as reference.
- Verify the skill loads (name/description frontmatter intact).

### 2. Token expansion (foundation — everything depends on it)
Extend `tokens.ts` to model what the DS CSS carries but the TS source does not yet:

- **elevation** (`flat`, `card`, `raised`, `sheet`, `scrim`) — hairline-first, shadow
  only for the web login card and floating sheets.
- **motion** (durations `instant/fast/base/sheet`, eases `standard/out`, press opacity)
  with a `prefers-reduced-motion` zeroing rule emitted in CSS.
- **border widths** (`hairline` 1px, `control` 1.5px, `accent` 4px, `accentRow` 5px,
  `gaugeStroke` 18px) and `radii.pill`.
- **semantic-alias layer** (`--text-*`, `--surface-*`, `--action-*`, `--border-*`,
  `--focus-ring`, `--space-*` roles, `--type-*` composite font shorthands, severity
  aliases `--ac-sev-*`, band `-text` colors, deep-chrome tints, `--ac-on-deep-*`).

Then:
- Enrich `toCssVars()` to emit the **full** var set for `:root` **and**
  `:root[data-theme="dark"]` (dark overrides only the neutrals/brand/code-bg per the DS;
  band fills never change across themes or print).
- Enrich `tailwindPreset`: add spacing scale, radii (incl. pill), boxShadow (elevation),
  band **text** colors, and the semantic color aliases.
- Web: inject the generated vars into `app/globals.css` (imported/emitted, not
  hand-copied from the DS `.css`). Load the three faces already wired via `next/font`.
- Member: extend the RN `theme` with `elevation`, `motion`, `radii.pill`, and border
  widths where screens need them.

### 3. Web component library (`apps/web/components/`)
Port the DS **core** kit as **Tailwind + token** React/TS components (matching the web
idiom, not inline CSS vars). Prop surfaces follow the DS `.d.ts`/`.prompt.md` verbatim:

- `Button` — variants `primary | secondary | deep | danger | ghost`; sizes
  `member` (48dp) / `field` (56dp, 18px label); `block`, `disabled`, `icon`.
- `Card` — `pad` `md | lg | none`; optional `accent` left status edge (band/severity
  token only); `interactive`.
- `StatusPill` — mono-caps lifecycle; tones
  `neutral | info | success | warn | danger | solid | solidDeep`.
- `EmptyState`, `FormField`, `Plate` (mono plate/VIN, `--ac-tracking-plate`).

Each ships with a colocated vitest + React Testing Library test asserting variants and
states render. Driven by what the flagship screens actually consume.

### 4. Web flagship re-skin
Convert to the new primitives without changing behavior (tests stay green):

- `app/staff/schedule/Board.tsx` — the dense, signature staff surface.
- `app/(public)/c/[token]/page.tsx` — the print-faithful certificate: gauge + band +
  mono verification code, `primary-deep` footer, no member contact data.

### 5. Member RN primitives (`apps/member/src/components/`)
The same core kit expressed as **React Native** components on the existing `theme`
(`Pressable`/`View`/`Text`): `Button`, `Card`, `StatusPill`, `EmptyState`, `FormField`.
Band colors stay protected (score/status only). Colocated jest + RTL-native tests.

### 6. Member flagship re-skin
- `features/health-score/HealthScoreScreen.tsx` — the score gauge (the one bold
  element) + detractor cards + "why this score?".
- `features/home/HomeScreen.tsx` — greeting, vehicle/plate card, primary actions.

Convert their hand-rolled buttons/cards/pills to the new primitives; behavior and
existing tests unchanged.

## Testing & verification

- **Token generation test:** assert `toCssVars()` output matches the values in the DS
  `tokens/*.css` (guards the "derivative stays in sync" claim). Extend the existing
  `packages/design-tokens/src/tokens.test.ts`.
- **Component tests:** colocated — web (vitest + RTL), member (jest + RTL-native) —
  assert variants/tones/sizes/disabled states render.
- **Regression:** all existing screen tests stay green after conversion.
- **Gate per phase:** `pnpm typecheck` + affected test suites green before moving on.
- **Visual check:** drive web (Next dev) and member (Expo) for the converted screens via
  the `/run` skill; confirm fonts, colors, spacing, and the gauge render on-brand.

## Sequencing summary

1 (skill/commit) → 2 (tokens, foundation) → 3 (web components) → 4 (web flagships) →
5 (member primitives) → 6 (member flagships). Phases 3–4 and 5–6 are independent of each
other once phase 2 lands.

## Risks

- **Token drift:** mitigated by generating from `tokens.ts` and the equality test vs the
  DS `.css`.
- **Idiom mismatch (Tailwind vs inline CSS vars):** resolved by shipping Tailwind
  components on web; the DS `.jsx` remain the contract, not the code.
- **Scope creep on the re-skin:** bounded explicitly to the four named flagship screens.
- **RN has no CSS vars:** member consumes the TS `theme`, not the generated CSS — the two
  outputs share one source (`tokens.ts`) so they cannot diverge.
