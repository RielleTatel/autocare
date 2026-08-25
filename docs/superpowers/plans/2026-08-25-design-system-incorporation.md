# Design System Incorporation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the AutoCare+ design-system skill, expand the shared token package to emit the full token set, port a core component library into `apps/web` and `apps/member`, and re-skin four flagship screens to the design-system grammar.

**Architecture:** `packages/design-tokens/src/tokens.ts` stays the single source of truth; the full CSS-var set and Tailwind preset are generated from it, and the design-system `.css` files remain reference-only (guarded by an equality test). Web gets Tailwind-based React/TS components; member gets React Native primitives on its existing `theme`. Flagship screens are converted to the primitives without behavior changes.

**Tech Stack:** TypeScript, Next.js + Tailwind (web, vitest + RTL), React Native / Expo (member, jest + RTL-native), pnpm workspaces, turbo.

**Spec:** `docs/superpowers/specs/2026-08-25-design-system-incorporation-design.md`

## Global Constraints

- **Source of truth:** all token *values* come from `packages/design-tokens/src/tokens.ts`. Never hand-copy values from the design-system `.css` files into app code.
- **Band colors are product data (Principle 1):** the five VHS band colors (`--ac-band-*`, `vhsBands`) appear only when they mean a score or inspection status — never on buttons, accents, or behind headings.
- **Touch targets:** 48dp member/web, 56dp field (NFR-027). Field type scale is ×1.125.
- **Behavior-preserving re-skin:** flagship screen conversions must not change behavior; all pre-existing tests stay green.
- **Test commands:** design-tokens `pnpm --filter @autocare/design-tokens test`; web `pnpm --filter web test`; member `pnpm --filter member test`. Typecheck a package with `pnpm --filter <name> typecheck`.
- **Dark theme:** only neutrals/brand/code-bg change under `[data-theme="dark"]`; band fills never change across theme or print.
- **Commit style:** end commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Phase 1 — Skill install + commit folder

### Task 1: Install the design-system folder as a project skill

**Files:**
- Move: `AutoCare+ Design System/` → `.claude/skills/autocare-plus-design/`

**Interfaces:**
- Produces: skill dir `.claude/skills/autocare-plus-design/` with `SKILL.md` at its root; reference paths `.claude/skills/autocare-plus-design/{components,tokens,guidelines,ui_kits,assets}/` used by later tasks for equality checks.

- [ ] **Step 1: Move the folder with git**

```bash
cd "/Users/tatelgabrielle/Desktop/PROJECTS/autocare"
mkdir -p .claude/skills
git add -A ".claude" 2>/dev/null || true
mv "AutoCare+ Design System" ".claude/skills/autocare-plus-design"
```

- [ ] **Step 2: Verify the skill frontmatter is intact**

Run: `head -6 .claude/skills/autocare-plus-design/SKILL.md`
Expected: YAML frontmatter with `name: autocare-plus-design`, `description:`, and `user-invocable: true`.

- [ ] **Step 3: Verify structure**

Run: `ls .claude/skills/autocare-plus-design`
Expected: `SKILL.md readme.md tokens components guidelines ui_kits assets` (among others).

- [ ] **Step 4: Commit**

```bash
git add -A ".claude/skills/autocare-plus-design"
git commit -m "chore: install autocare-plus-design as project skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Token expansion (foundation)

### Task 2: Model elevation, motion, borders, and radii.pill in tokens.ts

**Files:**
- Modify: `packages/design-tokens/src/tokens.ts`
- Test: `packages/design-tokens/src/tokens.test.ts`

**Interfaces:**
- Produces:
  - `export const elevation = { flat, card, raised, sheet, scrim } as const` (string CSS values).
  - `export const motion = { durInstant, durFast, durBase, durSheet, easeStandard, easeOut, pressOpacity } as const`.
  - `export const borders = { hairline: 1, control: 1.5, accent: 4, accentRow: 5, gaugeStroke: 18 } as const` (px numbers).
  - `radii` gains `pill: 999`.

- [ ] **Step 1: Write the failing test**

Add to `packages/design-tokens/src/tokens.test.ts`:

```typescript
import { elevation, motion, borders, radii } from "./tokens";

describe("extended tokens", () => {
  it("exposes hairline-first elevation with a sheet shadow", () => {
    expect(elevation.flat).toBe("none");
    expect(elevation.sheet).toContain("rgba(22, 35, 46, 0.16)");
    expect(elevation.scrim).toBe("rgba(22, 35, 46, 0.4)");
  });
  it("exposes motion durations and standard easing", () => {
    expect(motion.durFast).toBe("140ms");
    expect(motion.easeStandard).toBe("cubic-bezier(0.2, 0, 0.2, 1)");
    expect(motion.pressOpacity).toBe(0.82);
  });
  it("exposes border widths and a pill radius", () => {
    expect(borders.control).toBe(1.5);
    expect(borders.gaugeStroke).toBe(18);
    expect(radii.pill).toBe(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/design-tokens test`
Expected: FAIL — `elevation`/`motion`/`borders` not exported.

- [ ] **Step 3: Add the exports to tokens.ts**

Append to `packages/design-tokens/src/tokens.ts` (and add `pill: 999` to the existing `radii`):

```typescript
/** Elevation is hairlines, not shadow. Shadow appears only on the web login
 *  card and sheets/dialogs floating over a scrim. */
export const elevation = {
  flat: "none",
  card: "0 1px 2px rgba(22, 35, 46, 0.04)",
  raised: "0 1px 3px rgba(22, 35, 46, 0.08), 0 1px 2px rgba(22, 35, 46, 0.04)",
  sheet: "0 -8px 24px rgba(22, 35, 46, 0.16)",
  scrim: "rgba(22, 35, 46, 0.4)",
} as const;

/** Motion communicates state change, hierarchy and navigation — nothing else. */
export const motion = {
  durInstant: "90ms", durFast: "140ms", durBase: "220ms", durSheet: "280ms",
  easeStandard: "cubic-bezier(0.2, 0, 0.2, 1)", easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  pressOpacity: 0.82,
} as const;

/** Stroke widths (px). hairline card border, 1.5 control outline, 4/5 status edges. */
export const borders = { hairline: 1, control: 1.5, accent: 4, accentRow: 5, gaugeStroke: 18 } as const;
```

Change `export const radii = { sm: 6, md: 12, pill: 999 } as const;` (already has `pill` — leave as-is if present).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autocare/design-tokens test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/src/tokens.ts packages/design-tokens/src/tokens.test.ts
git commit -m "feat(tokens): model elevation, motion, borders, pill radius

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Emit the full CSS-var set (light + dark) from toCssVars()

**Files:**
- Modify: `packages/design-tokens/src/css-vars.ts`
- Test: `packages/design-tokens/src/css-vars.test.ts` (create)

**Interfaces:**
- Consumes: `colors`, `vhsBands`, `fontStacks`, `typeScale`, `spacing`, `radii`, `elevation`, `motion`, `borders`, `targets` from `./tokens`.
- Produces: `toCssVars(): string` returning a stylesheet string containing a `:root { … }` block with the full var set (neutrals/brand, band fill + `-text`, severity aliases, semantic color aliases, spacing `--ac-space-*`, radii `--ac-radius-*`, targets `--ac-target-*`, borders, fonts `--ac-font-*`, type sizes `--ac-size-*`, weights/leading/tracking, elevation `--ac-elevation-*`, motion `--ac-duration-*`/`--ac-ease-*`) and a `:root[data-theme="dark"] { … }` block overriding only `--ac-ink`, `--ac-ink-muted`, `--ac-chassis`, `--ac-surface`, `--ac-line`, `--ac-primary`, `--ac-primary-deep`, `--ac-code-bg`.

- [ ] **Step 1: Write the failing test**

Create `packages/design-tokens/src/css-vars.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { toCssVars } from "./css-vars";

describe("toCssVars", () => {
  const css = toCssVars();
  it("emits neutrals, brand, and band fill+text", () => {
    expect(css).toContain("--ac-ink: #16232E;");
    expect(css).toContain("--ac-primary: #0E5AA7;");
    expect(css).toContain("--ac-band-excellent: #177245;");
    expect(css).toContain("--ac-band-excellent-text: #0F5C37;");
  });
  it("emits spacing, radii, targets and borders", () => {
    expect(css).toContain("--ac-space-md: 16px;");
    expect(css).toContain("--ac-radius-pill: 999px;");
    expect(css).toContain("--ac-target-field: 56px;");
    expect(css).toContain("--ac-border-control: 1.5px;");
  });
  it("emits semantic aliases and motion", () => {
    expect(css).toContain("--text-primary: var(--ac-ink);");
    expect(css).toContain("--action-primary: var(--ac-primary);");
    expect(css).toContain("--ac-duration-fast: 140ms;");
    expect(css).toContain("--ac-ease-standard: cubic-bezier(0.2, 0, 0.2, 1);");
  });
  it("emits a dark block overriding neutrals but not band fills", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(dark).toContain("--ac-chassis: #101820;");
    expect(dark).toContain("--ac-primary: #4C95DB;");
    expect(dark).not.toContain("--ac-band-excellent:");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/design-tokens test css-vars`
Expected: FAIL — current `toCssVars` emits only colors + band fills.

- [ ] **Step 3: Rewrite css-vars.ts**

Replace `packages/design-tokens/src/css-vars.ts` with an implementation that builds the full set. Model the light `:root` and dark override exactly on `.claude/skills/autocare-plus-design/tokens/{colors,typography,spacing,elevation,motion}.css`. Derive every value from the imported token objects (do not hardcode). Dark overrides are the fixed set below (from the DS `colors.css`):

```typescript
import { colors, vhsBands, fontStacks, typeScale, spacing, radii, elevation, motion, borders, targets } from "./tokens";

const DARK = {
  ink: "#E4EAEF", inkMuted: "#9AAAB6", chassis: "#101820", surface: "#1A242E",
  line: "#2C3947", primary: "#4C95DB", primaryDeep: "#0A2E4F", codeBg: "#232F3A",
} as const;

export function toCssVars(): string {
  const line = (k: string, v: string) => `  ${k}: ${v};`;
  const root: string[] = [
    line("--ac-ink", colors.ink), line("--ac-ink-muted", colors.inkMuted),
    line("--ac-chassis", colors.chassis), line("--ac-surface", colors.surface),
    line("--ac-line", colors.line), line("--ac-primary", colors.primary),
    line("--ac-primary-deep", colors.primaryDeep), line("--ac-on-primary", colors.onPrimary),
    line("--ac-danger", colors.danger), line("--ac-success", colors.success),
    line("--ac-code-bg", "#E4E9EC"),
    // band fill + text
    ...Object.entries(vhsBands).flatMap(([k, v]) => {
      const s = k.toLowerCase().replace("_", "-");
      return [line(`--ac-band-${s}`, v.fill), line(`--ac-band-${s}-text`, v.text)];
    }),
    line("--ac-band-on", "#FFFFFF"),
    // severity aliases
    line("--ac-sev-critical", "var(--ac-band-critical)"),
    line("--ac-sev-attention", "var(--ac-band-needs-attention)"),
    line("--ac-sev-monitor", "var(--ac-band-fair)"),
    line("--ac-sev-info", "var(--ac-primary)"),
    // semantic color aliases
    line("--text-primary", "var(--ac-ink)"), line("--text-muted", "var(--ac-ink-muted)"),
    line("--text-on-primary", "var(--ac-on-primary)"), line("--text-link", "var(--ac-primary)"),
    line("--text-danger", "var(--ac-danger)"),
    line("--surface-app", "var(--ac-chassis)"), line("--surface-card", "var(--ac-surface)"),
    line("--surface-sunken", "var(--ac-chassis)"), line("--surface-chrome", "var(--ac-primary-deep)"),
    line("--surface-code", "var(--ac-code-bg)"),
    line("--border-hairline", "var(--ac-line)"), line("--border-strong", "var(--ac-ink)"),
    line("--action-primary", "var(--ac-primary)"), line("--action-primary-hover", "#0C4E90"),
    line("--action-primary-press", "#093C70"), line("--action-destructive", "var(--ac-danger)"),
    line("--action-disabled-bg", "var(--ac-line)"), line("--action-disabled-fg", "var(--ac-ink-muted)"),
    line("--focus-ring", "var(--ac-primary)"),
    // spacing
    ...Object.entries(spacing).map(([k, v]) => line(`--ac-space-${k}`, `${v}px`)),
    // radii
    line("--ac-radius-sm", `${radii.sm}px`), line("--ac-radius-md", `${radii.md}px`),
    line("--ac-radius-pill", `${radii.pill}px`),
    // targets + borders
    line("--ac-target-member", `${targets.memberMinDp}px`), line("--ac-target-field", `${targets.fieldMinDp}px`),
    line("--ac-hairline", `${borders.hairline}px`), line("--ac-border-control", `${borders.control}px`),
    line("--ac-border-accent", `${borders.accent}px`), line("--ac-border-accent-row", `${borders.accentRow}px`),
    line("--ac-gauge-stroke", `${borders.gaugeStroke}px`),
    // fonts + type
    line("--ac-font-display", fontStacks.display), line("--ac-font-body", fontStacks.body),
    line("--ac-font-mono", fontStacks.mono),
    ...Object.entries(typeScale).map(([k, v]) => line(`--ac-size-${k}`, `${v.size}rem`)),
    // elevation
    line("--ac-elevation-flat", elevation.flat), line("--ac-elevation-card", elevation.card),
    line("--ac-elevation-raised", elevation.raised), line("--ac-elevation-sheet", elevation.sheet),
    line("--ac-scrim", elevation.scrim),
    // motion
    line("--ac-duration-instant", motion.durInstant), line("--ac-duration-fast", motion.durFast),
    line("--ac-duration-base", motion.durBase), line("--ac-duration-sheet", motion.durSheet),
    line("--ac-ease-standard", motion.easeStandard), line("--ac-ease-out", motion.easeOut),
    line("--ac-press-opacity", String(motion.pressOpacity)),
  ];
  const dark: string[] = [
    line("--ac-ink", DARK.ink), line("--ac-ink-muted", DARK.inkMuted),
    line("--ac-chassis", DARK.chassis), line("--ac-surface", DARK.surface),
    line("--ac-line", DARK.line), line("--ac-primary", DARK.primary),
    line("--ac-primary-deep", DARK.primaryDeep), line("--ac-code-bg", DARK.codeBg),
  ];
  return `:root {\n${root.join("\n")}\n}\n:root[data-theme="dark"] {\n${dark.join("\n")}\n}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autocare/design-tokens test css-vars`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/src/css-vars.ts packages/design-tokens/src/css-vars.test.ts
git commit -m "feat(tokens): toCssVars emits full var set with dark overrides

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: Equality test — generated vars match the design-system reference CSS

**Files:**
- Test: `packages/design-tokens/src/css-vars.reference.test.ts` (create)

**Interfaces:**
- Consumes: `toCssVars()`; reads `.claude/skills/autocare-plus-design/tokens/colors.css`.

- [ ] **Step 1: Write the failing test**

Create `packages/design-tokens/src/css-vars.reference.test.ts`. It parses the reference `colors.css` for every `--ac-*: <value>;` declaration inside the light `:root` block and asserts `toCssVars()` contains the same declaration — proving the generated output is a faithful superset of the design system's color layer.

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toCssVars } from "./css-vars";

const ref = readFileSync(
  resolve(__dirname, "../../../.claude/skills/autocare-plus-design/tokens/colors.css"),
  "utf8",
);
// The light :root block is everything before the dark selector.
const lightRef = ref.slice(0, ref.indexOf('[data-theme="dark"]'));
const decls = [...lightRef.matchAll(/(--ac-[a-z-]+):\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()};`);

describe("generated CSS matches design-system reference (colors)", () => {
  const css = toCssVars();
  it.each(decls)("contains %s", (decl) => {
    expect(css).toContain(decl);
  });
});
```

- [ ] **Step 2: Run test to verify behavior**

Run: `pnpm --filter @autocare/design-tokens test css-vars.reference`
Expected: PASS (Task 3 already emits these). If any decl fails, fix `css-vars.ts` to match the reference value, then re-run.

- [ ] **Step 3: Commit**

```bash
git add packages/design-tokens/src/css-vars.reference.test.ts
git commit -m "test(tokens): assert generated vars match DS reference colors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5: Enrich the Tailwind preset

**Files:**
- Modify: `packages/design-tokens/src/tailwind-preset.ts`
- Test: `packages/design-tokens/src/tailwind-preset.test.ts` (create)

**Interfaces:**
- Consumes: `colors`, `vhsBands`, `fontStacks`, `radii`, `spacing`, `elevation`.
- Produces: `tailwindPreset.theme.extend` gains `spacing` (from the token scale, keyed `xs…xxl`), `borderRadius.pill`, `boxShadow` (`card`, `raised`, `sheet` from `elevation`), band `-text` colors (keys `<band>-text`), and semantic color aliases (`action-hover: "#0C4E90"`). Existing keys are preserved.

- [ ] **Step 1: Write the failing test**

Create `packages/design-tokens/src/tailwind-preset.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { tailwindPreset } from "./tailwind-preset";

const ext = tailwindPreset.theme.extend as any;

describe("tailwind preset", () => {
  it("exposes the spacing scale", () => {
    expect(ext.spacing.md).toBe("16px");
    expect(ext.spacing.xxl).toBe("48px");
  });
  it("exposes pill radius and elevation shadows", () => {
    expect(ext.borderRadius.pill).toBe("999px");
    expect(ext.boxShadow.sheet).toContain("rgba(22, 35, 46, 0.16)");
  });
  it("exposes band text colors alongside fills", () => {
    expect(ext.colors.band.excellent).toBe("#177245");
    expect(ext.colors.band["excellent-text"]).toBe("#0F5C37");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @autocare/design-tokens test tailwind-preset`
Expected: FAIL — `spacing`/`boxShadow`/band-text absent.

- [ ] **Step 3: Extend the preset**

In `packages/design-tokens/src/tailwind-preset.ts`, import `spacing, elevation` and extend `theme.extend`:
- `spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => [k, `${v}px`]))`
- add `pill: \`${radii.pill}px\`` to `borderRadius`
- `boxShadow: { card: elevation.card, raised: elevation.raised, sheet: elevation.sheet }`
- in `colors.band`, include both fill and `${key}-text` from `vhsBands` (`v.fill` and `v.text`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @autocare/design-tokens test tailwind-preset`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/src/tailwind-preset.ts packages/design-tokens/src/tailwind-preset.test.ts
git commit -m "feat(tokens): enrich tailwind preset (spacing, shadows, band-text)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: Rebuild the package and inject vars into web globals.css

**Files:**
- Modify: `packages/design-tokens/src/index.ts` (ensure `toCssVars` exported — already is)
- Create: `apps/web/app/tokens.css` (generated output, committed)
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/scripts/gen-tokens-css.mjs`

**Interfaces:**
- Consumes: `toCssVars()` from `@autocare/design-tokens`.
- Produces: `apps/web/app/tokens.css` containing the generated var blocks; `globals.css` imports it.

- [ ] **Step 1: Build the tokens package**

Run: `pnpm --filter @autocare/design-tokens build`
Expected: `dist/` updates with new `css-vars.js`.

- [ ] **Step 2: Write the generation script**

Create `apps/web/scripts/gen-tokens-css.mjs`:

```javascript
import { toCssVars } from "@autocare/design-tokens";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const header = "/* GENERATED from @autocare/design-tokens toCssVars(). Do not edit by hand.\n   Regenerate: node scripts/gen-tokens-css.mjs */\n";
writeFileSync(resolve(dir, "../app/tokens.css"), header + toCssVars());
console.log("wrote app/tokens.css");
```

- [ ] **Step 3: Generate the CSS**

Run: `cd apps/web && node scripts/gen-tokens-css.mjs`
Expected: prints `wrote app/tokens.css`; file exists with `:root { … }` and dark block.

- [ ] **Step 4: Import it from globals.css**

Edit `apps/web/app/globals.css` so the token vars load before Tailwind layers:

```css
@import "./tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Verify web still builds/typechecks**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/design-tokens/dist apps/web/app/tokens.css apps/web/app/globals.css apps/web/scripts/gen-tokens-css.mjs
git commit -m "feat(web): inject generated design tokens into globals

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: Extend the member RN theme

**Files:**
- Modify: `apps/member/src/theme/index.ts`
- Test: `apps/member/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: `elevation`, `motion`, `borders` from `@autocare/design-tokens`.
- Produces: `theme.elevation`, `theme.motion`, `theme.borders` available to member screens; `theme.radii.pill` present.

- [ ] **Step 1: Write the failing test**

Add to `apps/member/src/theme/theme.test.ts`:

```typescript
import { theme } from "./index";

describe("theme extensions", () => {
  it("exposes elevation, motion, borders, and pill radius", () => {
    expect(theme.elevation.card).toContain("rgba");
    expect(theme.motion.durFast).toBe("140ms");
    expect(theme.borders.control).toBe(1.5);
    expect(theme.radii.pill).toBe(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test theme`
Expected: FAIL — `theme.elevation` undefined.

- [ ] **Step 3: Extend the theme**

In `apps/member/src/theme/index.ts` import `elevation, motion, borders` from `@autocare/design-tokens` and add them to the exported `theme` object (`elevation`, `motion`, `borders`). `radii` already includes `pill` via the tokens package.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/theme/index.ts apps/member/src/theme/theme.test.ts
git commit -m "feat(member): extend theme with elevation/motion/borders

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Web component library

**Setup note (do once, in Task 8):** `apps/web/vitest.config.ts` `include` currently omits `components/**`. Add `"components/**/*.test.{ts,tsx}"` to the `include` array so component tests run.

### Task 8: Web Button

**Files:**
- Create: `apps/web/components/Button.tsx`
- Test: `apps/web/components/Button.test.tsx`
- Modify: `apps/web/vitest.config.ts`

**Interfaces:**
- Produces: `export function Button(props)` with props matching `.claude/skills/autocare-plus-design/components/core/Button.d.ts`: `{ children?, variant?: "primary"|"secondary"|"deep"|"danger"|"ghost", size?: "member"|"field", block?, disabled?, icon?, onClick?, type?: "button"|"submit", className?, ...rest }`. Tailwind-based; `primary` = `bg-primary text-white`, `secondary` = `border border-primary text-primary bg-transparent`, `deep` = `bg-primary-deep text-white`, `danger` = `bg-danger text-white`, `ghost` = `text-primary bg-transparent`; disabled = `bg-line text-ink-muted`. Heights: member `h-12` (48px), field `h-14` (56px) with `text-lg`.

- [ ] **Step 1: Add components glob to vitest include**

Edit `apps/web/vitest.config.ts` `include` array, adding `"components/**/*.test.{ts,tsx}"`.

- [ ] **Step 2: Write the failing test**

Create `apps/web/components/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Book a service</Button>);
    const btn = screen.getByRole("button", { name: "Book a service" });
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("applies the field size height", () => {
    render(<Button size="field">Start inspection</Button>);
    expect(screen.getByRole("button").className).toContain("h-14");
  });
  it("is disabled and non-interactive when disabled", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test Button`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement Button.tsx**

Create `apps/web/components/Button.tsx` (Tailwind classes, token colors, radius `rounded-sm`, transition on background). Follow the variant/size table in Interfaces. Merge `className` last so callers can extend.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test Button`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/Button.tsx apps/web/components/Button.test.tsx apps/web/vitest.config.ts
git commit -m "feat(web): DS Button component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: Web Card

**Files:**
- Create: `apps/web/components/Card.tsx`
- Test: `apps/web/components/Card.test.tsx`

**Interfaces:**
- Produces: `export function Card(props)` matching `Card.d.ts`: `{ children?, pad?: "md"|"lg"|"none", accent?: string, interactive?, onClick?, className? }`. Base = `bg-surface rounded-md border border-line`; pad `md` = `p-4`, `lg` = `p-6`, `none` = no padding. `accent` renders a 5px left status edge via inline `style={{ borderLeft: \`5px solid ${accent}\` }}`. `interactive` adds hover/cursor.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/Card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children with roomy padding", () => {
    render(<Card pad="lg">Inside</Card>);
    const el = screen.getByText("Inside");
    expect(el.className).toContain("p-6");
  });
  it("draws a left accent edge when accent is set", () => {
    render(<Card accent="var(--ac-sev-critical)">Warn</Card>);
    expect(screen.getByText("Warn")).toHaveStyle({ borderLeft: "5px solid var(--ac-sev-critical)" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test Card`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Card.tsx** per Interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test Card`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/Card.tsx apps/web/components/Card.test.tsx
git commit -m "feat(web): DS Card component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: Web StatusPill

**Files:**
- Create: `apps/web/components/StatusPill.tsx`
- Test: `apps/web/components/StatusPill.test.tsx`

**Interfaces:**
- Produces: `export function StatusPill(props)` matching `StatusPill.d.ts`: `{ children?, tone?: "neutral"|"info"|"success"|"warn"|"danger"|"solid"|"solidDeep", className? }`. Mono, uppercase-friendly, `rounded-pill`, 12px, letter-spacing. Tone→classes: `neutral` `bg-[color:var(--ac-code-bg)] text-ink`, `info` `text-primary border border-primary/35 bg-primary/10`, `success` `text-success border border-success/35 bg-success/10`, `warn` `text-[color:var(--ac-band-fair)] bg-[color:var(--ac-band-fair)]/15`, `danger` `text-danger bg-danger/10 border border-danger/35`, `solid` `bg-primary text-white`, `solidDeep` `bg-primary-deep text-white`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/StatusPill.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders content in a mono pill", () => {
    render(<StatusPill tone="success">SETTLED</StatusPill>);
    const el = screen.getByText("SETTLED");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("rounded-pill");
  });
  it("applies the solidDeep tone", () => {
    render(<StatusPill tone="solidDeep">CHROME</StatusPill>);
    expect(screen.getByText("CHROME").className).toContain("bg-primary-deep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test StatusPill`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement StatusPill.tsx** per Interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test StatusPill`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/StatusPill.tsx apps/web/components/StatusPill.test.tsx
git commit -m "feat(web): DS StatusPill component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: Web EmptyState, FormField, Plate

**Files:**
- Create: `apps/web/components/EmptyState.tsx`, `apps/web/components/FormField.tsx`, `apps/web/components/Plate.tsx`
- Test: `apps/web/components/EmptyState.test.tsx`, `apps/web/components/FormField.test.tsx`, `apps/web/components/Plate.test.tsx`

**Interfaces:**
- `EmptyState` (per `EmptyState.d.ts`): `{ title, body?, tone?: "empty"|"loading"|"error", action?, className? }`. One `Card`-shaped container; `error` tone gives a `text-danger` heading; `loading` renders 3 skeleton bars (`animate-pulse bg-line`).
- `FormField` (per `FormField.d.ts`): `{ label?, value?, placeholder?, error?, hint?, mono?, size?: "member"|"field", type?, onChange?, id?, className? }`. Uppercase label (`--ac-tracking-label`), sunken input (`bg-chassis border border-line rounded-sm`), 48/56px height by size, `mono` = `font-mono` + `tracking-[0.12em]`, `error` shown in `text-danger` below.
- `Plate` (per `Plate.d.ts`): `{ children?, variant?: "outline"|"chip"|"plain", className? }`. Mono + `tracking-[0.12em]`; `outline` = bordered specimen, `chip` = `bg-primary-deep text-white rounded-sm px-2 py-1`, `plain` = inline run.

- [ ] **Step 1: Write the failing tests**

Create the three test files. Example `Plate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Plate } from "./Plate";

describe("Plate", () => {
  it("renders mono chip variant", () => {
    render(<Plate variant="chip">ABC 1234</Plate>);
    const el = screen.getByText("ABC 1234");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("bg-primary-deep");
  });
});
```

`EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows an error heading in danger tone", () => {
    render(<EmptyState tone="error" title="Could not load" body="Try again." />);
    expect(screen.getByText("Could not load").className).toContain("text-danger");
  });
});
```

`FormField.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("emits changes and shows sentence-form errors", () => {
    const onChange = vi.fn();
    render(<FormField label="Plate" value="" onChange={onChange} error="Enter a plate number to continue." />);
    fireEvent.change(screen.getByLabelText("Plate"), { target: { value: "X" } });
    expect(onChange).toHaveBeenCalledWith("X");
    expect(screen.getByText("Enter a plate number to continue.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test "components/(EmptyState|FormField|Plate)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three components** per Interfaces. For `FormField`, associate `label` to the input via `htmlFor`/`id` (default a generated id) so `getByLabelText` works.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test "components/(EmptyState|FormField|Plate)"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/{EmptyState,FormField,Plate}.tsx apps/web/components/{EmptyState,FormField,Plate}.test.tsx
git commit -m "feat(web): DS EmptyState, FormField, Plate components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — Web flagship re-skin

### Task 12: Re-skin the staff schedule board

**Files:**
- Modify: `apps/web/app/staff/schedule/Board.tsx`
- Verify: `apps/web/app/staff/schedule/Board.test.tsx` (existing — must stay green)

**Interfaces:**
- Consumes: `StatusPill` from `apps/web/components/StatusPill`, `Card` from `apps/web/components/Card`.

- [ ] **Step 1: Read the existing test to learn the behavioral contract**

Run: `cat apps/web/app/staff/schedule/Board.test.tsx`
Note the queries/labels it asserts (status text, cancel action) — these must keep working.

- [ ] **Step 2: Replace the local StatusPill with the DS one**

In `Board.tsx`, delete the local `STATUS_STYLES`/`StatusPill` and map appointment status → DS `StatusPill` tone: `BOOKED`→`info`, `CONFIRMED`→`solidDeep`, `IN_PROGRESS`→`warn`, `COMPLETED`→`success`, `CANCELLED`→`neutral`, `NO_SHOW`→`danger`. Preserve the displayed label `status.replace("_", " ")`. If `Board.test.tsx` imports the local `StatusPill`, update it to import from `../../../components/StatusPill` or assert on rendered text instead.

- [ ] **Step 3: Wrap each hour group / appointment row in the DS `Card`** (`pad="md"`), keeping the existing layout and the `onCancel` row action.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter web test Board`
Expected: PASS (behavior unchanged).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/staff/schedule/Board.tsx apps/web/app/staff/schedule/Board.test.tsx
git commit -m "refactor(web): re-skin schedule board with DS components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 13: Re-skin the public certificate page

**Files:**
- Modify: `apps/web/app/(public)/c/[token]/page.tsx`

**Interfaces:**
- Consumes: `Plate` (verification code + plate), `Card` where the current `bg-surface rounded-md border border-line` wrapper is used.

- [ ] **Step 1: Replace ad-hoc surface wrappers with `Card`**

Swap the outer `<div className="bg-surface rounded-md border border-line overflow-hidden">` for the DS `Card` (`pad="none"` to preserve the flush header/sections). Keep the SVG `Gauge`, category bars, and `[data-theme]`-independent band colors exactly as-is (band colors are product data).

- [ ] **Step 2: Render the verification code and plate via `Plate`**

In the details grid, render `cert.verificationCode` and `cert.plateNo` through `<Plate variant="plain">` (keeps mono + tracking) instead of the local `font-mono` span. Leave the `Field` helper for non-mono values.

- [ ] **Step 3: Keep the deep-chrome header/footer** (`bg-[#0A2E4F]`) — optionally swap the literal to `bg-primary-deep` (same value via token) for consistency.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 5: Visual check**

Use the `/run` skill to start the web dev server and open a certificate route (or its Playwright fixture) to confirm the gauge, band label, and mono code render on-brand.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(public)/c/[token]/page.tsx"
git commit -m "refactor(web): re-skin certificate page with DS components

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 5 — Member RN primitives

### Task 14: Member Button

**Files:**
- Create: `apps/member/src/components/Button.tsx`
- Test: `apps/member/src/components/Button.test.tsx`

**Interfaces:**
- Produces: `export function Button(props)`: `{ children, variant?: "primary"|"secondary"|"deep"|"danger"|"ghost", size?: "member"|"field", block?, disabled?, onPress?, testID? }`. RN `Pressable`+`Text` on `theme`. Heights: member `theme.minTarget` (48), field 56. Colors: primary `theme.colors.primary`/`onPrimary`; secondary transparent + `borderColor: theme.colors.primary`; deep `theme.colors.primaryDeep`; danger `theme.colors.danger`; ghost transparent text-primary. Disabled = `theme.colors.line` bg + `theme.colors.inkMuted` text. Radius `theme.radii.sm`. Press feedback via `theme.motion.pressOpacity`.

- [ ] **Step 1: Write the failing test**

Create `apps/member/src/components/Button.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button } from "./Button";

describe("member Button", () => {
  it("renders label and fires onPress", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Book a service</Button>);
    fireEvent.press(screen.getByText("Book a service"));
    expect(onPress).toHaveBeenCalled();
  });
  it("does not fire when disabled", () => {
    const onPress = jest.fn();
    render(<Button disabled onPress={onPress}>Nope</Button>);
    fireEvent.press(screen.getByText("Nope"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter member test components/Button`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Button.tsx** per Interfaces (RN `Pressable`, `disabled` blocks `onPress`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter member test components/Button`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/components/Button.tsx apps/member/src/components/Button.test.tsx
git commit -m "feat(member): DS Button primitive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 15: Member Card, StatusPill, EmptyState, FormField

**Files:**
- Create: `apps/member/src/components/Card.tsx`, `StatusPill.tsx`, `EmptyState.tsx`, `FormField.tsx`
- Test: `apps/member/src/components/Card.test.tsx`, `StatusPill.test.tsx`, `EmptyState.test.tsx`, `FormField.test.tsx`

**Interfaces:**
- `Card`: `{ children, pad?: "md"|"lg"|"none", accent?: string, style? }`. `View` with `backgroundColor: theme.colors.surface`, `borderRadius: theme.radii.md`, `borderWidth: 1`, `borderColor: theme.colors.line`; pad md=16 lg=24; `accent` = left border 5px of the passed color.
- `StatusPill`: `{ children, tone?: "neutral"|"info"|"success"|"warn"|"danger"|"solid"|"solidDeep", style? }`. Rounded-pill `View`+mono `Text`; tone colors mirror the web pill using `theme.colors`/`theme.vhsBands.FAIR.fill` for warn.
- `EmptyState`: `{ title, body?, tone?: "empty"|"loading"|"error", action? }`. Card-shaped; error title uses `theme.colors.danger`.
- `FormField`: `{ label?, value?, placeholder?, error?, hint?, mono?, size?: "member"|"field", onChangeText?, testID? }`. RN `TextInput` sunken (`theme.colors.chassis` bg, hairline border); uppercase label; error in `theme.colors.danger`.

- [ ] **Step 1: Write the failing tests**

Create the four test files. Example `StatusPill.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";

describe("member StatusPill", () => {
  it("renders its label", () => {
    render(<StatusPill tone="success">SETTLED</StatusPill>);
    expect(screen.getByText("SETTLED")).toBeTruthy();
  });
});
```

`Card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("member Card", () => {
  it("renders children", () => {
    render(<Card><Text>Inside</Text></Card>);
    expect(screen.getByText("Inside")).toBeTruthy();
  });
});
```

`EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { EmptyState } from "./EmptyState";

describe("member EmptyState", () => {
  it("shows title and body", () => {
    render(<EmptyState title="Nothing yet" body="Add a vehicle to begin." />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByText("Add a vehicle to begin.")).toBeTruthy();
  });
});
```

`FormField.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FormField } from "./FormField";

describe("member FormField", () => {
  it("emits text changes", () => {
    const onChangeText = jest.fn();
    render(<FormField label="Plate" value="" onChangeText={onChangeText} testID="plate" />);
    fireEvent.changeText(screen.getByTestId("plate"), "ABC");
    expect(onChangeText).toHaveBeenCalledWith("ABC");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter member test "components/(Card|StatusPill|EmptyState|FormField)"`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the four components** per Interfaces.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter member test "components/(Card|StatusPill|EmptyState|FormField)"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/components/{Card,StatusPill,EmptyState,FormField}.tsx apps/member/src/components/{Card,StatusPill,EmptyState,FormField}.test.tsx
git commit -m "feat(member): DS Card, StatusPill, EmptyState, FormField primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 6 — Member flagship re-skin

### Task 16: Re-skin HomeScreen

**Files:**
- Modify: `apps/member/src/features/home/HomeScreen.tsx`
- Verify: any existing HomeScreen/HomeTabs tests stay green.

**Interfaces:**
- Consumes: `Button`, `Card`, `Plate`-equivalent (use member `StatusPill` with `solidDeep` tone for the plate chip, or a mono `Text`; keep plate mono treatment) from `apps/member/src/components`.

- [ ] **Step 1: Replace the vehicle card `View` with `Card`** (`pad="md"`), keeping the plate chip (mono, `primaryDeep` bg) and odometer line.

- [ ] **Step 2: Replace the three `Pressable` actions with `Button`**: "Add vehicle" (`primary`), "Update odometer" (`secondary`), "Book a service" (`deep`). Preserve `testID`s (`quick-add-vehicle`, `quick-update-odometer`, `quick-book-service`) and `onPress` handlers.

- [ ] **Step 3: Run member tests**

Run: `pnpm --filter member test Home`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter member typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/member/src/features/home/HomeScreen.tsx
git commit -m "refactor(member): re-skin HomeScreen with DS primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 17: Re-skin HealthScoreScreen

**Files:**
- Modify: `apps/member/src/features/health-score/HealthScoreScreen.tsx`
- Verify: `apps/member/src/features/health-score/ScoreGauge.test.tsx` and any HealthScoreScreen test stay green.

**Interfaces:**
- Consumes: `Card`, `StatusPill` from `apps/member/src/components`. Keep `ScoreGauge` and `StarRating` unchanged (the gauge is the one bold element).

- [ ] **Step 1: Replace the "Why this score?" and detractor `View`/`Pressable` cards with `Card`** (`pad="md"`), preserving the expand/collapse behavior and copy.

- [ ] **Step 2: Replace the inline severity pill with `StatusPill`**, mapping `severityColor` status → tone: `CRITICAL`→`danger`, `ATTENTION`→`warn`, `MONITOR`→`warn` (label preserved: "Critical"/"Attention"/"Monitor"). Keep band colors for the gauge only.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter member test health-score`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter member typecheck`
Expected: PASS.

- [ ] **Step 5: Visual check**

Use the `/run` skill to launch the member app (Expo) and open Home + Health Score; confirm buttons, cards, pills, and the gauge render on-brand.

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/health-score/HealthScoreScreen.tsx
git commit -m "refactor(member): re-skin HealthScoreScreen with DS primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run the full suite: `pnpm test`
- [ ] Run typecheck across the workspace: `pnpm typecheck`
- [ ] Confirm all commits are present and the working tree is clean: `git status`
