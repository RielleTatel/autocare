# Checkpoint — Design System Incorporation (2026-08-25)

## Status: foundation + web done; member screen rebuild NOT yet matching the mockups (parked by user)

The user asked to "incorporate the design system to the project" from the
`AutoCare+ Design System/` folder. This session installed the skill, built the
shared token + component foundation, re-skinned the web flagships, and then
attempted to rebuild the member screens to match the design system's HTML
mockups. **The member screen rebuild is not visually accurate to the mockups
yet** — the user reviewed it on-device, said "it's not accurate," and chose to
continue another time. All work is committed to `main` (NOT pushed).

Spec: `docs/superpowers/specs/2026-08-25-design-system-incorporation-design.md`
Plan: `docs/superpowers/plans/2026-08-25-design-system-incorporation.md`
Commits: `3820e1e` → `17da603` (20 commits).

---

## What the design-system folder actually is

`AutoCare+ Design System/` was a Figma/skill **recreation** of the design
language already in the repo. Its readme states every token value was read out
of `packages/design-tokens/src/tokens.ts` (the declared source of truth) plus
the four apps. So the **token values already matched the repo** — the folder's
genuinely new content is: a web React component library (`components/*.jsx`),
HTML guideline cards, per-surface `ui_kits/` **screen mockups**, logo assets, a
richer CSS-var set, and a `user-invocable` Claude skill (`SKILL.md`).

**Key mockup reference (this is the visual target the user wants):**
`.claude/skills/autocare-plus-design/AutoCare+ Member App.html` and
`.claude/skills/autocare-plus-design/ui_kits/member-app/*.jsx`
(HomeScreen.jsx, OtherScreens.jsx = Vehicles/Bookings/Account, HealthScoreScreen.jsx,
BookingFlow.jsx, RoadsideScreens.jsx, data.jsx).

---

## Done and committed

### 1. Skill install (`3820e1e`)
Moved the folder to `.claude/skills/autocare-plus-design/` (its single committed
home; it was untracked). `/autocare-plus-design` is now a user-invocable project
skill. The DS `tokens/*.css` live there as **reference only** — apps consume
generated output, not those files.

### 2. Token foundation — source of truth stays `tokens.ts`, generated outward
- `80353ad` — added `elevation`, `motion`, `borders` exports (+ `radii.pill`) to
  `packages/design-tokens/src/tokens.ts`.
- `b7c8a7a` — `toCssVars()` now emits the FULL var set + a `:root[data-theme="dark"]`
  block (only neutrals/brand/code-bg flip in dark; band fills never change).
- `916899d` — **value-guard test** `css-vars.reference.test.ts`: asserts every
  literal hex in the DS reference `colors.css` appears in generated output.
  Added `--ac-on-deep-*` masthead tints that the reference had.
- `a2ce95a` — enriched the Tailwind preset (spacing scale, `pill` radius,
  elevation `boxShadow`, band `-text` colors, `action-hover`).
- `dcea81d` — `apps/web/scripts/gen-tokens-css.mjs` generates
  `apps/web/app/tokens.css` (committed), imported first in `globals.css`.
- `4a3f9e4` — member RN `theme` extended with `elevation`/`motion`/`borders`.

**Naming decision:** kept the repo convention `--ac-band-needs-attention`
(the existing Tailwind preset uses `replace("_","-")`), NOT the DS folder's
`band-attention` shorthand. That's why the reference guard is value-based, not
exact-name. `packages/design-tokens/dist/` is gitignored (turbo rebuilds it) —
run `pnpm --filter @autocare/design-tokens build` before the web gen script or a
cold `apps/web` build.

### 3. Web component library (`e84faec`, `251fd80`, `8402083`, `5cdf61b`, `428f457`)
`apps/web/components/`: `Button`, `Card`, `StatusPill`, `EmptyState`, `FormField`,
`Plate` — **Tailwind + tokens** (not the DS folder's inline-CSS `.jsx`). Notes:
- Added `components/**` to `apps/web/vitest.config.ts` `include`.
- Web component tests need **explicit `vitest` imports** (`import { describe, it, expect, vi } from "vitest"`) — tsc has no globals; the existing app tests already import them.
- jsdom CSSOM drops `border-left` shorthands containing `var()` — Card accent test asserts the inline `style` attribute string instead of `toHaveStyle`.

### 4. Web flagship re-skins (`d1c1706`, `c0882f1`)
- `app/staff/schedule/Board.tsx` — DS `StatusPill` (status→tone map) + `Card`.
- `app/(public)/c/[token]/page.tsx` — DS `Card` + `Plate`; kept the SVG gauge and band colors.

### 5. Member RN primitives (`0e444d5`, `b0faeb8`)
`apps/member/src/components/`: `Button`, `Card`, `StatusPill`, `EmptyState`,
`FormField` (+ later `BandChip`). Built on the `theme`. `Card` gained
`interactive`/`onPress`/`testID` passthrough during the screen rebuild.

### 6. Member screen re-skin — TWO passes
- **Pass 1 (`13f99af`, `35fd739`)** — conservative: swapped hand-rolled
  buttons/cards for DS primitives but **kept the existing sparse layouts**.
  Result: pixels ~identical to before (tokens were already applied). User asked
  "why does the UI still look the same?" — this is why.
- **Pass 2 (`4ba7fc1`, `17da603`)** — rebuilt Home + Vehicles + Bookings +
  Account + Health Score to **recompose** toward the mockups: logo masthead +
  subscription line, richer vehicle card (band chip + stars + health score),
  car-icon vehicle rows, roadside card, plan+status card with ACTIVE pill,
  gauge-in-a-card. Wired subscription + per-vehicle health-score data in
  `RootNavigator` containers (defensive `.catch`).

---

## ⚠️ Where it stands: NOT accurate to the mockups

The user reviewed Pass 2 on the Android dev client and said **"it's not accurate."**
Screens are DS-composed and functionally intact, but do not yet faithfully match
`AutoCare+ Member App.html`. Known gaps / likely reasons (for next session):

- **Icons are placeholders**, not the mockup's Lucide/line icons: the roadside
  card uses a `☎` text glyph; the vehicle row uses a hand-drawn SVG car path.
  There is **no icon library** in `apps/member` yet — the mockups use `<Icon name="..." />` (calendar-plus, phone, car-front, plus, chevron, list-tree, trending-up, share-2). Adding a proper icon set (e.g. lucide-react-native or an SVG icon component matching the DS `Icon`) is probably the biggest fidelity gap.
- **Spacing / proportions** likely differ from the mockups (padding, gaps, card
  density, type sizing) — needs a side-by-side pass against the HTML.
- **Roadside** has no backend (Phase 6) — the Home roadside card's `onRoadside`
  is a placeholder that currently routes to Bookings. Call-out counts are
  placeholder text.
- **Work-order approval card** on Bookings is an optional prop (`pendingApproval`)
  — not yet wired to real pending work orders in the booking container, so it
  doesn't render.
- **Account "Change plan" PlanCards** from the mockup were NOT built — the plan
  cards live behind the existing "Upgrade or downgrade" flow (UpgradeDowngradeScreen).
  The mockup shows them inline on Account.
- **Band pill + stars** only render for vehicles that have a health score from an
  inspection; vehicles without one show a fallback link / no chip.
- Logo: copied `logo-mark.png` into `apps/member/assets/` and used it in the Home
  masthead. The DS readme warns the logo is a raster with a baked frame and its
  amber is NOT a UI color (too close to the FAIR band token) — do not adopt logo
  yellow as an accent.

**Deviation flagged earlier (Principle 1):** HealthScore severity chips are kept
band-colored (product data) via `Card` `accent`, not mapped to generic
`StatusPill` lifecycle tones.

---

## Verification at parked state
- design-tokens 37, web 35, member 112 tests — all green.
- Typecheck: web + member clean (full workspace `pnpm typecheck` was 8/8 earlier).
- All 20 commits on `main`, working tree clean, **NOT pushed to origin**.

## How to run (from the two dev-environment checkpoints)
- **API:** `pnpm --filter api run start` (port 3001, `/api/v1/health`). DB is
  hosted Supabase (`apps/api/.env` DATABASE_URL); needs Redis.
- **Member:** cannot run in Expo Go (native Firebase → `RNFBAppModule not found`).
  Needs the **custom dev client** (Android APK already built for account `srielle`,
  build `899f5ac1-...`). Run `pnpm --filter member start`, open the installed dev
  client on the phone, connect to Metro. JS changes hot-reload; the user was
  viewing Pass-2 screens this way.

## Next session — suggested first moves
1. Add a real **icon set** to `apps/member` matching the DS `Icon` names, and
   replace the glyph/SVG placeholders on Home + Vehicles + Bookings + Health Score.
2. Do a **side-by-side fidelity pass** of each screen against
   `AutoCare+ Member App.html` (open it in a browser next to the dev client):
   spacing, type scale, card density, exact copy.
3. Decide roadside + inline PlanCards on Account: build vs. keep as placeholder.
4. `apps/field` was intentionally NOT re-skinned (RN; same tokens apply later).
