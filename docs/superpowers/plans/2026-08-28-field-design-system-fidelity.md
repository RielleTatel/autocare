# Field App Design-System Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/field` to visual parity with `AutoCare+ Design System/AutoCare+ Field App.html` — starting with the unregistered typefaces that make every heading fall back to the system face.

**Architecture:** Register the three brand faces and guard that with a test; add a lucide `Icon` layer; port a primitive library from `apps/member/src/components/` re-tuned to field's 56dp targets; then re-skin all nine screens on top of those primitives. A new `TaskListScreen` reads the existing Phase 3 scheduling board endpoint and caches it for offline use.

**Tech Stack:** React Native 0.86 / Expo SDK 57, `expo-font` + `@expo-google-fonts`, `lucide-react-native`, `@autocare/design-tokens`, jest-expo + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-08-28-field-design-system-fidelity-design.md`

## Global Constraints

- **Touch targets are 56dp** in field (`targets.fieldMinDp`), not member's 48. Gloved hands, sunlight. This is a hard requirement (NFR-027).
- **The type scale is ×1.125** in field. `Math.round(t.size * 16 * 1.125)`. Never hand-pick a font size outside the scale.
- **`theme.text()` must never return `fontWeight`.** RN treats each (family, weight) pair as a separate registered family; `fontWeight` alongside a custom `fontFamily` is ignored on iOS and mis-synthesised on Android.
- **Band colours are product data, never decoration** — the five VHS band colours appear only when they mean a score or an inspection status. Never on buttons, accents, or behind headings.
- **Stroke widths come from `borders`**: `hairline: 1`, `control: 1.5`, `accent: 4`, `accentRow: 5`, `gaugeStroke: 18`. No hardcoded stroke numbers.
- **Icons are imported individually** from `lucide-react-native`. Metro does not tree-shake the 1,778-icon barrel; a namespace import bundles the whole set.
- **After any `pnpm --filter field add`, run a root `pnpm install`.** A filtered add pruned `apps/field`'s `@testing-library/react-native` store link during the member pass and broke its typecheck.
- **Bilingual layouts tolerate ~30% text expansion** — Filipino labels sit under English ones and must not clip.
- **Existing test contracts that must stay green** (accessibility labels and testIDs other tests query):
  - PointEntry: `Front pads measured value`, `Good` / `Attention` / `Critical`, `Add photo (required)`, `Save and next`, `Notes`, and `testID="derived-status-chip"`.
  - ReviewSubmit: `Submit inspection`, `Complete Discs`, the text `Front pads — Needs attention`, the text `Score will appear when synced`.
  - WasteEntry: `Coolant`, `Quantity`, `Queue waste record`, and `getByLabelText("Used oil").props.style.minHeight >= 56`.
  - SyncBanner: the text `3 items waiting to sync`.

---

### Task 1: Register the brand typefaces

The defect that motivates the whole pass. Everything downstream renders in the wrong face until this lands, so it goes first and gets a regression test.

**Files:**
- Create: `apps/field/src/theme/fonts.ts`
- Create: `apps/field/src/theme/theme.test.ts`
- Modify: `apps/field/src/theme/index.ts` (whole file)
- Modify: `apps/field/src/app/App.tsx:1-25` (imports + font gate)
- Modify: `apps/field/package.json` (dependencies)
- Modify: `apps/field/jest.config.js` (add `.mjs` transform)

**Interfaces:**
- Consumes: `@autocare/design-tokens` — `colors`, `spacing`, `radii`, `typeScale`, `targets`, `vhsBands`, `elevation`, `motion`, `borders`.
- Produces: `fieldTheme` with `text(role, weight?) => TextStyle` (no `fontWeight`), `familyForRole(role, weight?) => FontName`, plus `elevation` / `motion` / `borders` passthrough. `fontAssets` and the `FontName` type from `theme/fonts.ts`.

- [ ] **Step 1: Add the font dependencies**

```bash
cd apps/field
pnpm add expo-font @expo-google-fonts/barlow-semi-condensed @expo-google-fonts/inter @expo-google-fonts/ibm-plex-mono
cd ../.. && pnpm install
```

The trailing root `pnpm install` is not optional — see Global Constraints.

- [ ] **Step 2: Write the failing theme guard test**

Create `apps/field/src/theme/theme.test.ts`:

```ts
import { fieldTheme, familyForRole } from "./index";
import { fontAssets } from "./fonts";
import { typeScale } from "@autocare/design-tokens";

const ROLES = Object.keys(typeScale) as Array<keyof typeof typeScale>;

describe("fieldTheme.text", () => {
  it("resolves every type-scale role to a registered font family", () => {
    for (const role of ROLES) {
      const family = fieldTheme.text(role).fontFamily as string;
      expect(Object.keys(fontAssets)).toContain(family);
    }
  });

  it("never emits fontWeight — RN mis-synthesises it against a named family", () => {
    for (const role of ROLES) {
      expect(fieldTheme.text(role)).not.toHaveProperty("fontWeight");
    }
  });

  it("scales every role by the 1.125 field step", () => {
    expect(fieldTheme.text("h1").fontSize).toBe(32);
    expect(fieldTheme.text("h2").fontSize).toBe(25);
    expect(fieldTheme.text("body").fontSize).toBe(18);
    expect(fieldTheme.text("label").fontSize).toBe(15);
  });

  it("reaches the emphasis weight without inventing a size", () => {
    expect(familyForRole("body", 600)).toBe("Inter_600SemiBold");
    expect(fieldTheme.text("body", 600).fontSize).toBe(fieldTheme.text("body").fontSize);
  });

  it("enforces the 56dp gloved touch target", () => {
    expect(fieldTheme.minTarget).toBe(56);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- theme.test.ts`
Expected: FAIL — `Cannot find module './fonts'`.

- [ ] **Step 4: Create the font asset map**

Create `apps/field/src/theme/fonts.ts`. Keys must stay byte-identical to the exported asset names — `familyForRole` builds these strings.

```ts
// The three AutoCare+ faces, imported per-weight so Metro bundles only the five
// faces the type scale actually uses rather than all 18 weights of each family.
//
// React Native does NOT synthesise weights for custom families: each (family,
// weight) pair is its own registered fontFamily. `familyForRole` in ./index.ts
// resolves the type-scale role to one of these exact names.
import { BarlowSemiCondensed_600SemiBold } from "@expo-google-fonts/barlow-semi-condensed/600SemiBold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";

export const fontAssets = {
  BarlowSemiCondensed_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  // Not a type-scale role of its own — the emphasis weight for button labels
  // and inline links, reached via `fieldTheme.text("body", 600)`.
  Inter_600SemiBold,
  IBMPlexMono_500Medium,
} as const;

export type FontName = keyof typeof fontAssets;
```

- [ ] **Step 5: Rewrite the theme**

Replace `apps/field/src/theme/index.ts` entirely:

```ts
import {
  colors, spacing, radii, typeScale, targets, vhsBands, elevation, motion, borders,
} from "@autocare/design-tokens";
import type { TextStyle } from "react-native";
import type { FontName } from "./fonts";

/** Token family → the @expo-google-fonts family prefix that ships that face.
 *  Set `body` to "System" to revert to the native system stack (see the spec's
 *  flagged deviation). */
const familyPrefix = { display: "BarlowSemiCondensed", body: "Inter", mono: "IBMPlexMono" } as const;

/** Token weight → the suffix @expo-google-fonts uses for that weight. */
const weightSuffix: Record<number, string> = { 400: "400Regular", 500: "500Medium", 600: "600SemiBold" };

/** The field app renders every role one step larger than member. */
const FIELD_SCALE = 1.125;

export function familyForRole(role: keyof typeof typeScale, weight?: 400 | 500 | 600): FontName {
  const t = typeScale[role];
  return `${familyPrefix[t.family]}_${weightSuffix[weight ?? t.weight]}` as FontName;
}

/** Field theme derives from the shared tokens — never redefines them. It scales
 *  every type role one step larger (×1.125) and enforces 56dp gloved targets. */
export const fieldTheme = {
  colors,
  spacing,
  radii,
  vhsBands,
  elevation,
  motion,
  borders,
  minTarget: targets.fieldMinDp,
  /**
   * `weight` overrides the role's default face — use it for the emphasis weight
   * on button labels, never to invent a size/weight pairing outside the scale.
   * Deliberately does not emit `fontWeight`: the weight lives in the family name.
   */
  text(role: keyof typeof typeScale, weight?: 400 | 500 | 600): TextStyle {
    const t = typeScale[role];
    return {
      fontSize: Math.round(t.size * 16 * FIELD_SCALE),
      fontFamily: familyForRole(role, weight),
    };
  },
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/field && pnpm test -- theme.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Gate the app on font loading**

In `apps/field/src/app/App.tsx`, add the imports and hold the tree until the faces resolve. Add to the import block at the top:

```tsx
import { useFonts } from "expo-font";
import { fontAssets } from "../theme/fonts";
```

Then insert at the top of the `App` component body, before the existing `useState`:

```tsx
  // Every screen styles text through `fieldTheme.text()`, which names the Barlow
  // / Inter / IBM Plex faces directly. Rendering before they register shows a
  // frame of system-font fallback and reflow. `error` counts as loaded on
  // purpose: a missing face should degrade to the system font, never to a
  // permanently blank app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
```

And immediately before the existing `return (`:

```tsx
  if (!fontsLoaded && !fontError) return <Splash />;
```

`Splash` is already defined in this file — reuse it rather than adding a second loading view.

- [ ] **Step 8: Teach jest to transform lucide's `.mjs` (needed from Task 2 on)**

Replace the top of `apps/field/jest.config.js` so it reuses the preset's own babel transform for `.mjs`:

```js
const expoPreset = require("jest-expo/jest-preset");

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // The preset only transforms `\.[jt]sx?$`, so `.mjs` sources fall through
  // untransformed and blow up on their first `export` — which is how
  // lucide-react-native ships (its package `exports` resolves the react-native
  // condition to dist/esm/*.mjs).
  transform: {
    ...expoPreset.transform,
    "\\.mjs$": expoPreset.transform["\\.[jt]sx?$"],
  },
```

Leave the existing `moduleNameMapper` and `transformIgnorePatterns` keys untouched.

- [ ] **Step 9: Run the whole field suite**

Run: `cd apps/field && pnpm test && pnpm typecheck`
Expected: PASS — the 33 existing tests plus the 5 new ones.

- [ ] **Step 10: Commit**

```bash
git add apps/field/package.json apps/field/jest.config.js apps/field/src/theme apps/field/src/app/App.tsx pnpm-lock.yaml
git commit -m "fix(field): register the three brand faces

The theme named BarlowSemiCondensed_600SemiBold and IBMPlexMono_500Medium
but nothing ever registered them — no expo-font, no useFonts — so every
heading and mono plate silently fell back to the system face. Same defect
fixed in apps/member on 2026-08-27.

text() now resolves an exact registered family and no longer emits
fontWeight, which RN ignores on iOS and mis-synthesises on Android."
```

---

### Task 2: Icon primitive

**Files:**
- Create: `apps/field/src/components/Icon.tsx`
- Create: `apps/field/src/components/Icon.test.tsx`
- Modify: `apps/field/package.json`

**Interfaces:**
- Consumes: `fieldTheme` from Task 1.
- Produces: `Icon({ name, size?, color? })` and the `IconName` union. Names are the design system's kebab names.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/field && pnpm add lucide-react-native && cd ../.. && pnpm install
```

- [ ] **Step 2: Write the failing test**

Create `apps/field/src/components/Icon.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders a glyph for a design-system kebab name", () => {
    const { toJSON } = render(<Icon name="wrench" size={20} />);
    expect(toJSON()).toBeTruthy();
  });

  it("stays out of the accessibility tree — it always sits beside its own label", () => {
    const { toJSON } = render(<Icon name="camera" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("importantForAccessibility");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- Icon.test.tsx`
Expected: FAIL — `Cannot find module './Icon'`.

- [ ] **Step 4: Implement the Icon**

Create `apps/field/src/components/Icon.tsx`. The glyph set covers every icon the Field App mockup references plus the sync/waste entity glyphs that replace emoji:

```tsx
import {
  Wrench, RefreshCw, ChevronLeft, ChevronRight, ClipboardCheck, Camera, Image,
  ArrowUpDown, Check, ArrowUpRight, Droplet, Battery, Filter, CircleDot,
  Truck, ClipboardList, Banknote, Package,
} from "lucide-react-native";
import { fieldTheme } from "../theme";

/**
 * The design system's icon set (`components/core/Icon.jsx`) is Lucide, chosen for
 * its 2px square-cap geometric construction. That file pins lucide-static 0.544.0
 * and addresses glyphs by kebab name; this map keeps those exact names so a name
 * lifted straight from a mockup resolves here.
 *
 * Icons are imported one by one rather than wholesale: Metro does not reliably
 * tree-shake the 1,778-icon barrel, so a namespace import pulls in the whole set.
 */
const GLYPHS = {
  "wrench": Wrench,
  "refresh-cw": RefreshCw,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "clipboard-check": ClipboardCheck,
  "camera": Camera,
  "image": Image,
  "arrow-up-down": ArrowUpDown,
  "check": Check,
  "arrow-up-right": ArrowUpRight,
  // Sync-queue and waste entity glyphs — these replace the emoji that stood in
  // for them (🛢️ 💧 🔋 🧽 🛞 🚚 📋 💵 📦).
  "droplet": Droplet,
  "battery": Battery,
  "filter": Filter,
  "circle-dot": CircleDot,
  "truck": Truck,
  "clipboard-list": ClipboardList,
  "banknote": Banknote,
  "package": Package,
} as const;

export type IconName = keyof typeof GLYPHS;

/** DS size steps: 16 inline, 20 default, 22 leading, 24 card leading. Field
 *  leans on the larger steps for sunlight legibility. */
export type IconSize = 16 | 20 | 22 | 24;

export function Icon({
  name,
  size = 22,
  color = fieldTheme.colors.ink,
}: {
  name: IconName;
  size?: IconSize | number;
  color?: string;
}) {
  const Glyph = GLYPHS[name];
  return (
    // Decorative by system rule: an icon always sits beside its own text label
    // and is never the only signal for a status, so it stays out of the a11y
    // tree rather than duplicating that label to screen readers.
    <Glyph
      size={size}
      color={color}
      strokeWidth={2}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/field && pnpm test -- Icon.test.tsx`
Expected: PASS, 2 tests. If it fails with a syntax error inside a `.mjs` file, Task 1 Step 8 was skipped.

- [ ] **Step 6: Commit**

```bash
git add apps/field/package.json apps/field/src/components/Icon.tsx apps/field/src/components/Icon.test.tsx pnpm-lock.yaml
git commit -m "feat(field): lucide icon primitive keyed by design-system names"
```

---

### Task 3: Core primitives — Card, Button, StatusPill, Plate

Ported from `apps/member/src/components/` and re-tuned to field. Member's `Button` and `FormField` already carry a `size="field"` variant; field's versions default to it.

**Files:**
- Create: `apps/field/src/components/Card.tsx`, `Button.tsx`, `StatusPill.tsx`, `Plate.tsx`
- Create: `apps/field/src/components/Card.test.tsx`, `Button.test.tsx`, `StatusPill.test.tsx`, `Plate.test.tsx`

**Interfaces:**
- Consumes: `fieldTheme` (Task 1), `Icon` / `IconName` (Task 2).
- Produces:
  - `Card({ children, pad?: "md"|"lg"|"none", accent?: string, interactive?, onPress?, style?, testID?, accessibilityLabel? })`
  - `Button({ children, variant?: "primary"|"secondary"|"deep"|"danger"|"ghost", block?, disabled?, onPress?, icon?: IconName, testID?, accessibilityLabel?, style? })` — always 56dp tall.
  - `StatusPill({ children, tone?: "neutral"|"info"|"success"|"warn"|"danger"|"solid"|"solidDeep", style? })`
  - `Plate({ children: string, variant?: "chip"|"plain"|"outline", style?, testID? })`

- [ ] **Step 1: Write the failing tests**

Create `apps/field/src/components/Card.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children on a hairline surface", () => {
    render(<Card><Text>Brakes</Text></Card>);
    expect(screen.getByText("Brakes")).toBeTruthy();
  });

  it("becomes a button when given an onPress", () => {
    const onPress = jest.fn();
    render(<Card onPress={onPress} accessibilityLabel="Open brakes"><Text>Brakes</Text></Card>);
    fireEvent.press(screen.getByLabelText("Open brakes"));
    expect(onPress).toHaveBeenCalled();
  });

  it("draws the accent edge at the token width", () => {
    render(<Card testID="c" accent="#B3261E"><Text>x</Text></Card>);
    expect(screen.getByTestId("c").props.style.borderLeftWidth).toBe(5);
  });
});
```

Create `apps/field/src/components/Button.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  it("meets the 56dp gloved touch target", () => {
    render(<Button testID="b">Save & next</Button>);
    expect(screen.getByTestId("b").props.style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("labels itself from a string child", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Submit inspection</Button>);
    fireEvent.press(screen.getByLabelText("Submit inspection"));
    expect(onPress).toHaveBeenCalled();
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    render(<Button disabled onPress={onPress}>Submit inspection</Button>);
    fireEvent.press(screen.getByLabelText("Submit inspection"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

Create `apps/field/src/components/StatusPill.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders its lifecycle label", () => {
    render(<StatusPill tone="warn">RETRYING</StatusPill>);
    expect(screen.getByText("RETRYING")).toBeTruthy();
  });
});
```

Create `apps/field/src/components/Plate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { Plate } from "./Plate";

describe("Plate", () => {
  it("renders the plate in the mono face", () => {
    render(<Plate testID="p">ABC 1234</Plate>);
    expect(screen.getByTestId("p").props.style.fontFamily).toBe("IBMPlexMono_500Medium");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/field && pnpm test -- src/components`
Expected: FAIL — modules not found for Card, Button, StatusPill, Plate.

- [ ] **Step 3: Implement Card**

Create `apps/field/src/components/Card.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";

const PAD = { md: fieldTheme.spacing.md, lg: fieldTheme.spacing.lg, none: 0 } as const;

/** Surface container — hairline border, radius 12, no shadow (elevation is line). */
export function Card({
  children, pad = "md", accent, interactive, onPress, style, testID, accessibilityLabel,
}: {
  children: ReactNode;
  pad?: "md" | "lg" | "none";
  /** Left status edge, 5px. Pass a band/severity colour (score/status only). */
  accent?: string;
  interactive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const boxStyle: ViewStyle = {
    backgroundColor: fieldTheme.colors.surface,
    borderRadius: fieldTheme.radii.md,
    borderWidth: fieldTheme.borders.hairline,
    borderColor: fieldTheme.colors.line,
    padding: PAD[pad],
    ...(accent ? { borderLeftWidth: fieldTheme.borders.accentRow, borderLeftColor: accent } : null),
    ...style,
  };
  if (interactive || onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [boxStyle, pressed ? { opacity: fieldTheme.motion.pressOpacity } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={boxStyle}>{children}</View>;
}
```

- [ ] **Step 4: Implement Button**

Create `apps/field/src/components/Button.tsx`. Unlike member's, there is no size prop — field is always 56dp:

```tsx
import type { ReactNode } from "react";
import { Pressable, Text, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "deep" | "danger" | "ghost";
type Look = { bg: string; fg: string; border?: string };

const VARIANT: Record<Variant, Look> = {
  primary: { bg: fieldTheme.colors.primary, fg: fieldTheme.colors.onPrimary },
  secondary: { bg: "transparent", fg: fieldTheme.colors.primary, border: fieldTheme.colors.primary },
  deep: { bg: fieldTheme.colors.primaryDeep, fg: fieldTheme.colors.onPrimary },
  danger: { bg: fieldTheme.colors.danger, fg: "#FFFFFF" },
  ghost: { bg: "transparent", fg: fieldTheme.colors.primary },
};

/** Field buttons are always the 56dp gloved target — there is no compact size. */
export function Button({
  children, variant = "primary", block = true, disabled, onPress, testID, icon, accessibilityLabel, style,
}: {
  children: ReactNode;
  variant?: Variant;
  /** Field buttons default to full-bleed; pass false for an inline action. */
  block?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: IconName;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const v = VARIANT[variant];
  const fg = disabled ? fieldTheme.colors.inkMuted : v.fg;
  const height = fieldTheme.minTarget;
  const base: ViewStyle = {
    height,
    minHeight: height,
    borderRadius: fieldTheme.radii.md,
    paddingHorizontal: fieldTheme.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: fieldTheme.spacing.sm,
    backgroundColor: disabled ? fieldTheme.colors.line : v.bg,
    borderWidth: v.border ? fieldTheme.borders.control : 0,
    borderColor: v.border,
    alignSelf: block ? "stretch" : "flex-start",
    width: block ? "100%" : undefined,
    ...style,
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && !disabled ? { opacity: fieldTheme.motion.pressOpacity } : null]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ ...fieldTheme.text("body", 600), color: fg }}>{children}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 5: Implement StatusPill**

Create `apps/field/src/components/StatusPill.tsx`:

```tsx
import type { ReactNode } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { fieldTheme } from "../theme";

type Tone = "neutral" | "info" | "success" | "warn" | "danger" | "solid" | "solidDeep";
type Look = { bg: string; fg: string };

/** warn uses the FAIR band token (product data); the others are brand/semantic. */
const TONE: Record<Tone, Look> = {
  neutral: { bg: fieldTheme.colors.chassis, fg: fieldTheme.colors.ink },
  info: { bg: fieldTheme.colors.primary, fg: "#FFFFFF" },
  success: { bg: fieldTheme.colors.success, fg: "#FFFFFF" },
  warn: { bg: fieldTheme.vhsBands.FAIR.fill, fg: "#FFFFFF" },
  danger: { bg: fieldTheme.colors.danger, fg: "#FFFFFF" },
  solid: { bg: fieldTheme.colors.primary, fg: "#FFFFFF" },
  solidDeep: { bg: fieldTheme.colors.primaryDeep, fg: "#FFFFFF" },
};

/** Mono-caps lifecycle pill — work orders, sync entries, appointment states. */
export function StatusPill({
  children, tone = "neutral", style,
}: {
  children: ReactNode;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const t = TONE[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: t.bg,
        borderRadius: fieldTheme.radii.pill,
        paddingHorizontal: fieldTheme.spacing.sm,
        paddingVertical: 2,
        ...style,
      }}
    >
      <Text style={{ ...fieldTheme.text("label"), color: t.fg }}>{children}</Text>
    </View>
  );
}
```

- [ ] **Step 6: Implement Plate**

Create `apps/field/src/components/Plate.tsx`:

```tsx
import { Text, View, type TextStyle } from "react-native";
import { fieldTheme } from "../theme";

type Variant = "chip" | "plain" | "outline";

/**
 * Machine identity — plate numbers, VINs, verification codes. Always the mono
 * face, always letter-spaced, never used for prose.
 *
 * `chip` is the navy chip on vehicle cards; `plain` is the bare mono run used
 * inside list rows (what the task list and review screens use); `outline` is the
 * boxed, plate-like treatment.
 */
export function Plate({
  children, variant = "outline", style, testID,
}: {
  children: string;
  variant?: Variant;
  style?: TextStyle;
  testID?: string;
}) {
  const t = fieldTheme;

  if (variant === "plain") {
    return (
      <Text testID={testID} style={{ ...t.text("code"), color: t.colors.ink, letterSpacing: 1, ...style }}>
        {children}
      </Text>
    );
  }

  const chip = variant === "chip";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: t.radii.sm,
        paddingHorizontal: chip ? t.spacing.sm : 14,
        paddingVertical: 4,
        backgroundColor: chip ? t.colors.primaryDeep : t.colors.surface,
        ...(chip ? null : { borderWidth: 2, borderColor: t.colors.ink }),
      }}
    >
      <Text
        testID={testID}
        style={{
          ...t.text("code"),
          letterSpacing: chip ? 1 : 2,
          color: chip ? t.colors.onPrimary : t.colors.ink,
          ...style,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- src/components`
Expected: PASS — 8 new tests plus Icon's 2.

- [ ] **Step 8: Commit**

```bash
git add apps/field/src/components
git commit -m "feat(field): port Card, Button, StatusPill and Plate primitives

Ported from apps/member/src/components and re-tuned to the 56dp gloved
target and the x1.125 field type scale. Field buttons have no compact
size — every button is the full target."
```

---

### Task 4: Support primitives — EmptyState, FormField, FieldNav

`FieldNav` is the piece the app is most conspicuously missing: the mockup gives every screen a 52dp bar with a back affordance, and no screen in the app has one.

**Files:**
- Create: `apps/field/src/components/EmptyState.tsx`, `FormField.tsx`, `FieldNav.tsx`
- Create: `apps/field/src/components/FieldNav.test.tsx`, `FormField.test.tsx`

**Interfaces:**
- Consumes: `fieldTheme`, `Icon`, `Card` (Tasks 1–3).
- Produces:
  - `EmptyState({ title, body?, tone?: "empty"|"loading"|"error", action? })`
  - `FormField({ label?, value?, placeholder?, error?, hint?, mono?, multiline?, keyboardType?, onChangeText?, testID?, accessibilityLabel? })` — 56dp tall.
  - `FieldNav({ title, onBack?, right? })`

- [ ] **Step 1: Write the failing tests**

Create `apps/field/src/components/FieldNav.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { FieldNav } from "./FieldNav";

describe("FieldNav", () => {
  it("shows the screen title", () => {
    render(<FieldNav title="Brakes · 1 of 4" />);
    expect(screen.getByText("Brakes · 1 of 4")).toBeTruthy();
  });

  it("offers a back affordance only when it can go back", () => {
    const onBack = jest.fn();
    const { rerender } = render(<FieldNav title="Sync queue" onBack={onBack} />);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalled();

    rerender(<FieldNav title="Today" />);
    expect(screen.queryByLabelText("Back")).toBeNull();
  });
});
```

Create `apps/field/src/components/FormField.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("meets the 56dp gloved target", () => {
    render(<FormField accessibilityLabel="Quantity" testID="q" />);
    expect(screen.getByTestId("q").props.style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("reports errors in sentence form, not as a code", () => {
    render(<FormField accessibilityLabel="Quantity" error="Enter a quantity greater than zero." />);
    expect(screen.getByText("Enter a quantity greater than zero.")).toBeTruthy();
  });

  it("passes text changes up", () => {
    const onChangeText = jest.fn();
    render(<FormField accessibilityLabel="Quantity" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText("Quantity"), "2.5");
    expect(onChangeText).toHaveBeenCalledWith("2.5");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/field && pnpm test -- FieldNav.test.tsx FormField.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement FieldNav**

Create `apps/field/src/components/FieldNav.tsx`:

```tsx
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "./Icon";

/**
 * The bar every field screen wears: 52dp of surface, a hairline underneath, a
 * primary back affordance and the screen title. `right` takes a status slot —
 * the task list puts the signed-in mechanic there.
 */
export function FieldNav({
  title, onBack, right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const t = fieldTheme;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.sm,
        minHeight: 52,
        backgroundColor: t.colors.surface,
        borderBottomWidth: t.borders.hairline,
        borderBottomColor: t.colors.line,
        paddingHorizontal: t.spacing.sm,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: t.spacing.xs }}
        >
          <Icon name="chevron-left" size={22} color={t.colors.primary} />
          <Text style={{ ...t.text("h2"), color: t.colors.primary }}>Back</Text>
        </Pressable>
      ) : null}
      <Text numberOfLines={1} style={{ ...t.text("h2"), color: t.colors.ink, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
```

- [ ] **Step 4: Implement FormField**

Create `apps/field/src/components/FormField.tsx`:

```tsx
import { Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { fieldTheme } from "../theme";

/** Uppercase label + sunken input + sentence-form error (never a code). */
export function FormField({
  label, value, placeholder, error, hint, mono, multiline, keyboardType, onChangeText, testID, accessibilityLabel,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onChangeText?: (value: string) => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = fieldTheme;
  const height = t.minTarget;
  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel ?? label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={t.colors.inkMuted}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          height: multiline ? undefined : height,
          minHeight: height,
          backgroundColor: t.colors.surface,
          borderWidth: t.borders.hairline,
          borderColor: error ? t.colors.danger : t.colors.line,
          borderRadius: t.radii.md,
          paddingHorizontal: t.spacing.md,
          paddingVertical: multiline ? t.spacing.md : undefined,
          color: t.colors.ink,
          ...t.text(mono ? "code" : "body"),
          ...(mono ? { letterSpacing: 2 } : null),
        }}
      />
      {error ? (
        <Text style={{ ...t.text("label"), color: t.colors.danger }}>{error}</Text>
      ) : hint ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Implement EmptyState**

Create `apps/field/src/components/EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Card } from "./Card";

/** One card shape for empty, loading and error — an absence never reads as a bug. */
export function EmptyState({
  title, body, tone = "empty", action,
}: {
  title: string;
  body?: string;
  tone?: "empty" | "loading" | "error";
  action?: ReactNode;
}) {
  const t = fieldTheme;
  return (
    <Card pad="lg">
      <View style={{ alignItems: "center", gap: t.spacing.sm }}>
        <Text style={{ ...t.text("h2"), color: tone === "error" ? t.colors.danger : t.colors.ink, textAlign: "center" }}>
          {title}
        </Text>
        {body ? (
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted, textAlign: "center" }}>{body}</Text>
        ) : null}
        {action ? <View style={{ marginTop: t.spacing.sm, alignSelf: "stretch" }}>{action}</View> : null}
      </View>
    </Card>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- src/components`
Expected: PASS — 5 new tests plus the 10 from Tasks 2–3.

- [ ] **Step 7: Commit**

```bash
git add apps/field/src/components
git commit -m "feat(field): add EmptyState, FormField and the FieldNav bar

FieldNav is the chrome every mockup screen has and no screen in the app
had — screens either invented a primaryDeep block header or shipped with
no back affordance at all."
```

---

### Task 5: Inspection primitives — StatusChip, StatusChoice, ScoreGauge

The three field-only primitives. `StatusChip` and `StatusChoice` must satisfy the existing PointEntry test contract (see Global Constraints) — `StatusChoice` labels itself with the human status label, `StatusChip` forwards a `testID`.

**Files:**
- Create: `apps/field/src/components/StatusChip.tsx`, `StatusChoice.tsx`, `ScoreGauge.tsx`
- Create: `apps/field/src/components/StatusChip.test.tsx`, `StatusChoice.test.tsx`, `ScoreGauge.test.tsx`

**Interfaces:**
- Consumes: `fieldTheme` (Task 1), `@autocare/scoring`'s `PointStatus`, `@autocare/design-tokens`'s `vhsBands` / `bandForScore`.
- Produces:
  - `STATUS_LABELS: Record<PointStatus, string>` and `statusColor(s: PointStatus): string`, both exported from `StatusChip.tsx` so the screens share one mapping.
  - `StatusChip({ status, testID? })`
  - `StatusChoice({ status, selected, disabled?, onPress? })`
  - `ScoreGauge({ score, band?, size?, confidence? })`

- [ ] **Step 1: Write the failing tests**

Create `apps/field/src/components/StatusChip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { StatusChip, statusColor, STATUS_LABELS } from "./StatusChip";
import { vhsBands } from "@autocare/design-tokens";

describe("StatusChip", () => {
  it("renders the human label, not the enum", () => {
    render(<StatusChip status="NOT_APPLICABLE" />);
    expect(screen.getByText("N/A")).toBeTruthy();
    expect(STATUS_LABELS.ATTENTION).toBe("Attention");
  });

  it("keeps CRITICAL and ATTENTION visually distinct — they are product data", () => {
    expect(statusColor("CRITICAL")).toBe(vhsBands.CRITICAL.fill);
    expect(statusColor("ATTENTION")).toBe(vhsBands.NEEDS_ATTENTION.fill);
    expect(statusColor("CRITICAL")).not.toBe(statusColor("ATTENTION"));
  });

  it("forwards a testID so screens can assert the derived status", () => {
    render(<StatusChip status="GOOD" testID="derived-status-chip" />);
    expect(screen.getByTestId("derived-status-chip")).toHaveTextContent("Good");
  });
});
```

Create `apps/field/src/components/StatusChoice.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { StatusChoice } from "./StatusChoice";

describe("StatusChoice", () => {
  it("labels itself with the human status and meets the gloved target", () => {
    render(<StatusChoice status="ATTENTION" selected={false} testID="c" />);
    expect(screen.getByLabelText("Attention")).toBeTruthy();
    expect(screen.getByTestId("c").props.style.minHeight).toBeGreaterThanOrEqual(56);
  });

  it("announces selection to assistive tech", () => {
    render(<StatusChoice status="GOOD" selected />);
    expect(screen.getByLabelText("Good").props.accessibilityState.selected).toBe(true);
  });

  it("does not fire while disabled", () => {
    const onPress = jest.fn();
    render(<StatusChoice status="GOOD" selected={false} disabled onPress={onPress} />);
    fireEvent.press(screen.getByLabelText("Good"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

Create `apps/field/src/components/ScoreGauge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { ScoreGauge } from "./ScoreGauge";

describe("ScoreGauge", () => {
  it("shows the score and its band", () => {
    render(<ScoreGauge score={69} />);
    expect(screen.getByText("69")).toBeTruthy();
    expect(screen.getByText(/Fair/)).toBeTruthy();
  });

  it("clamps out-of-range scores rather than drawing past the arc", () => {
    render(<ScoreGauge score={140} />);
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("states confidence when the inspection was partial", () => {
    render(<ScoreGauge score={69} confidence="MEDIUM" />);
    expect(screen.getByText(/MEDIUM confidence/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/field && pnpm test -- StatusChip.test.tsx StatusChoice.test.tsx ScoreGauge.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement StatusChip and the shared status mapping**

Create `apps/field/src/components/StatusChip.tsx`:

```tsx
import { Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../theme";

export const STATUS_LABELS: Record<PointStatus, string> = {
  GOOD: "Good",
  MONITOR: "Monitor",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
  NOT_APPLICABLE: "N/A",
};

/**
 * Point status → band fill. These are protected band tokens: the chip is
 * reporting inspection data, which is the one thing band colour is allowed to
 * mean. NOT_APPLICABLE is deliberately neutral — it is an absence, not a grade.
 */
export function statusColor(s: PointStatus): string {
  const t = fieldTheme;
  switch (s) {
    case "GOOD": return t.vhsBands.EXCELLENT.fill;
    case "MONITOR": return t.vhsBands.FAIR.fill;
    case "ATTENTION": return t.vhsBands.NEEDS_ATTENTION.fill;
    case "CRITICAL": return t.vhsBands.CRITICAL.fill;
    case "NOT_APPLICABLE": return t.colors.inkMuted;
  }
}

export function StatusChip({ status, testID }: { status: PointStatus; testID?: string }) {
  const t = fieldTheme;
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: statusColor(status),
        borderRadius: t.radii.pill,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.xs,
      }}
    >
      <Text style={{ ...t.text("label"), color: "#FFFFFF" }}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}
```

- [ ] **Step 4: Implement StatusChoice**

Create `apps/field/src/components/StatusChoice.tsx`:

```tsx
import { Pressable, Text } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../theme";
import { STATUS_LABELS, statusColor } from "./StatusChip";

/** One of the five stacked status rows on PointEntry. Selected fills with the
 *  band colour; unselected is a plain surface row. Sized for gloves. */
export function StatusChoice({
  status, selected, disabled, onPress, testID,
}: {
  status: PointStatus;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const t = fieldTheme;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={STATUS_LABELS[status]}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: t.minTarget,
        borderRadius: t.radii.md,
        borderWidth: selected ? 0 : t.borders.hairline,
        borderColor: t.colors.line,
        backgroundColor: selected ? statusColor(status) : t.colors.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ ...t.text("h2"), color: selected ? "#FFFFFF" : t.colors.ink }}>
        {STATUS_LABELS[status]}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 5: Implement ScoreGauge**

Create `apps/field/src/components/ScoreGauge.tsx`. The arc math moves here verbatim from `ScoreResultScreen`; the only change is `stroke` now comes from the token:

```tsx
import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { Band } from "@autocare/scoring";
import { fieldTheme } from "../theme";

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const s = polar(cx, cy, r, fromDeg);
  const e = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * The 0–100 VHS gauge — a half arc that grows from its left origin, same
 * geometry as the member gauge. The numeral is pinned to the design system's
 * `--ac-size-score` (72) rather than the field type step: it is sized by the
 * gauge geometry, not by the running text scale.
 */
export function ScoreGauge({
  score, band, size = 240, confidence,
}: {
  score: number;
  band?: Band;
  size?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}) {
  const t = fieldTheme;
  const stroke = t.borders.gaugeStroke;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const progressDeg = 180 - (clamped / 100) * 180;
  const bandInfo = vhsBands[(band ?? bandForScore(clamped)) as Band];
  const head = polar(cx, cy, r, progressDeg);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size / 2 + stroke}>
        <Path d={arcPath(cx, cy, r, 180, 0)} stroke={t.colors.line} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {clamped > 0 && (
          <Path d={arcPath(cx, cy, r, 180, progressDeg)} stroke={bandInfo.fill} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        )}
        <Circle cx={head.x} cy={head.y} r={stroke / 2.5} fill={bandInfo.fill} />
      </Svg>
      <View style={{ position: "absolute", top: size / 4, alignItems: "center" }}>
        <Text style={{ ...t.text("score"), fontSize: 72, color: bandInfo.text }}>{clamped}</Text>
      </View>
      <Text style={{ ...t.text("h2"), color: bandInfo.text }}>
        {bandInfo.labelEn} · {bandInfo.labelFil}
      </Text>
      {confidence ? (
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{confidence} confidence</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- src/components`
Expected: PASS — 9 new tests plus the 15 from Tasks 2–4.

- [ ] **Step 7: Commit**

```bash
git add apps/field/src/components
git commit -m "feat(field): add StatusChip, StatusChoice and ScoreGauge

ScoreGauge lifts the arc math out of ScoreResultScreen unchanged and
corrects its hardcoded stroke of 20 to the borders.gaugeStroke token (18).
STATUS_LABELS and statusColor are exported here so every inspection screen
shares one status mapping."
```

---

### Task 6: SyncBanner routes to the queue

**Files:**
- Modify: `apps/field/src/shared/SyncBanner.tsx` (whole file)
- Modify: `apps/field/src/shared/SyncBanner.test.tsx` (add a case)
- Modify: `apps/field/src/features/home/StaffHomeScreen.tsx:19` (pass the handler — this file is replaced in Task 7, so the edit is only to keep the tree compiling)

**Interfaces:**
- Consumes: `fieldTheme`, `Icon` (Tasks 1–2).
- Produces: `SyncBanner({ pendingCount, onPress? })` — unchanged text contract, `3 items waiting to sync`.

- [ ] **Step 1: Add the failing test case**

Append to `apps/field/src/shared/SyncBanner.test.tsx`:

```tsx
  it("opens the sync queue when tapped", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<SyncBanner pendingCount={3} onPress={onPress} />);
    fireEvent.press(getByLabelText("3 items waiting to sync"));
    expect(onPress).toHaveBeenCalled();
  });
```

Add `fireEvent` to the existing `@testing-library/react-native` import at the top of that file.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- SyncBanner.test.tsx`
Expected: FAIL — `Unable to find an element with accessibility label`.

- [ ] **Step 3: Implement**

Replace `apps/field/src/shared/SyncBanner.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import { fieldTheme } from "../theme";
import { Icon } from "../components/Icon";

/** Persistent offline/pending indicator. Tapping it opens the sync queue. */
export function SyncBanner({ pendingCount, onPress }: { pendingCount: number; onPress?: () => void }) {
  const t = fieldTheme;
  if (pendingCount === 0) return null;

  const label = `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to sync`;
  const body = (
    <>
      <Icon name="refresh-cw" size={20} color="#FFFFFF" />
      <Text style={{ ...t.text("body", 600), color: "#FFFFFF", textAlign: "center" }}>{label}</Text>
    </>
  );
  const style = {
    backgroundColor: t.colors.primaryDeep,
    padding: t.spacing.sm,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: t.spacing.sm,
  };

  if (!onPress) {
    return <View accessibilityRole="alert" style={style}>{body}</View>;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {body}
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/field && pnpm test -- SyncBanner.test.tsx`
Expected: PASS, 2 tests. The original `getByText("3 items waiting to sync")` case must still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/field/src/shared/SyncBanner.tsx apps/field/src/shared/SyncBanner.test.tsx
git commit -m "feat(field): make the sync banner open the queue"
```

---

### Task 7: TaskListScreen on the scheduling board

Replaces `StaffHomeScreen` as the Home route. Reads `GET /scheduling/board`, which `MECHANIC` may already call, and caches the result for offline use following the `checklistCache.ts` precedent.

**Files:**
- Create: `apps/field/src/features/tasks/tasksApi.ts`
- Create: `apps/field/src/features/tasks/TaskListScreen.tsx`
- Create: `apps/field/src/features/tasks/TaskListScreen.test.tsx`
- Delete: `apps/field/src/features/home/StaffHomeScreen.tsx`
- Modify: `apps/field/src/app/App.tsx` (Home route now renders TaskListScreen)

**Interfaces:**
- Consumes: `api` from `../../shared/api`, `kvGet` / `kvSet` from `../../shared/db/kv`, `useSyncStatus` + `syncProcessor` from the sync module, and `Card` / `Button` / `Plate` / `StatusPill` / `EmptyState` / `FieldNav` / `SyncBanner`.
- Produces:
  - `type FieldTask = { id: string; scheduledStart: string; vehiclePlateNo: string; serviceTypeName: string; memberName: string | null; status: string }`
  - `getTodaysTasks(): Promise<{ tasks: FieldTask[]; stale: boolean }>`
  - `TaskListScreen({ name, role, onStartInspection, onOpenSyncQueue })`

- [ ] **Step 1: Write the failing tests**

Create `apps/field/src/features/tasks/TaskListScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import { TaskListScreen } from "./TaskListScreen";
import * as tasksApi from "./tasksApi";

jest.mock("./tasksApi");
const mocked = tasksApi as jest.Mocked<typeof tasksApi>;

const task = {
  id: "a1",
  scheduledStart: "2026-08-28T01:00:00.000Z", // 09:00 Manila
  vehiclePlateNo: "ABC 1234",
  serviceTypeName: "Preventive maintenance",
  memberName: "R. Tatel",
  status: "IN_PROGRESS",
};

const props = { name: "J. Cruz", role: "MECHANIC", onStartInspection: jest.fn(), onOpenSyncQueue: jest.fn() };

describe("TaskListScreen", () => {
  it("lists today's work with its plate, service and Manila start time", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [task], stale: false });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText("Preventive maintenance")).toBeTruthy());
    expect(screen.getByText("ABC 1234")).toBeTruthy();
    expect(screen.getByText("09:00")).toBeTruthy();
    expect(screen.getByText("IN PROGRESS")).toBeTruthy();
  });

  it("says the day is clear rather than showing an empty screen", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [], stale: false });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText("Nothing booked today")).toBeTruthy());
  });

  it("marks a cached list as last-known when offline", async () => {
    mocked.getTodaysTasks.mockResolvedValue({ tasks: [task], stale: true });
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByText(/Showing the last list downloaded/)).toBeTruthy());
  });

  it("offers a retry when there is nothing cached to fall back on", async () => {
    mocked.getTodaysTasks.mockRejectedValue(new Error("offline"));
    render(<TaskListScreen {...props} />);
    await waitFor(() => expect(screen.getByLabelText("Try again")).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/field && pnpm test -- TaskListScreen.test.tsx`
Expected: FAIL — `Cannot find module './TaskListScreen'`.

- [ ] **Step 3: Implement the data layer**

Create `apps/field/src/features/tasks/tasksApi.ts`:

```ts
import { api } from "../../shared/api";
import { kvGet, kvSet } from "../../shared/db/kv";

const KEY = "tasks:today";

export type FieldTask = {
  id: string;
  scheduledStart: string;
  vehiclePlateNo: string;
  serviceTypeName: string;
  memberName: string | null;
  status: string;
};

/** Manila civil date, which is what the board endpoint expects. */
export function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/**
 * Today's work from the Phase 3 advisor board. MECHANIC is inside STAFF_ROLES,
 * so this needs no API change.
 *
 * Online: refresh and overwrite the cache. Offline: serve the last download and
 * say so — a mechanic in a basement bay still needs this morning's list. Throws
 * only when there is nothing cached at all.
 */
export async function getTodaysTasks(): Promise<{ tasks: FieldTask[]; stale: boolean }> {
  const day = todayManila();
  try {
    const fresh = await api.get<FieldTask[]>(`/scheduling/board?from=${day}&to=${day}`);
    await kvSet(KEY, JSON.stringify({ day, tasks: fresh }));
    return { tasks: fresh, stale: false };
  } catch (err) {
    const cached = await kvGet(KEY);
    if (!cached) throw err;
    const parsed = JSON.parse(cached) as { day: string; tasks: FieldTask[] };
    return { tasks: parsed.tasks, stale: true };
  }
}
```

- [ ] **Step 4: Implement the screen**

Create `apps/field/src/features/tasks/TaskListScreen.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { EmptyState } from "../../components/EmptyState";
import { FieldNav } from "../../components/FieldNav";
import { SyncBanner } from "../../shared/SyncBanner";
import { syncProcessor } from "../../shared/sync";
import { useSyncStatus } from "../../shared/sync/useSyncStatus";
import { getTodaysTasks, type FieldTask } from "./tasksApi";

type Tone = "neutral" | "info" | "success" | "warn" | "danger";

/** Appointment lifecycle → pill tone. Mirrors the mockup's STATUS_TONE. */
const STATUS_TONE: Record<string, Tone> = {
  BOOKED: "info",
  CONFIRMED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

const manilaTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false });

const manilaDay = () =>
  new Date().toLocaleDateString("en-PH", { timeZone: "Asia/Manila", day: "numeric", month: "short" });

/** F-01 — the mechanic's day. Work is listed in start order; the two standing
 *  actions sit under it. */
export function TaskListScreen({
  name, role, onStartInspection, onOpenSyncQueue,
}: {
  name: string | null;
  role: string;
  onStartInspection?: () => void;
  onOpenSyncQueue?: () => void;
}) {
  const t = fieldTheme;
  const sync = useSyncStatus(syncProcessor);
  const [tasks, setTasks] = useState<FieldTask[] | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { tasks: fresh, stale: isStale } = await getTodaysTasks();
      setTasks(fresh);
      setStale(isStale);
    } catch {
      setTasks(null);
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav
        title={`Today · ${manilaDay()}`}
        right={
          <Text style={{ ...t.text("label"), color: t.colors.inkMuted, paddingRight: t.spacing.sm }}>
            {role.charAt(0) + role.slice(1).toLowerCase()} · {name ?? "Staff"}
          </Text>
        }
      />
      <SyncBanner pendingCount={sync.pendingCount} onPress={onOpenSyncQueue} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        {stale ? (
          <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
            Showing the last list downloaded — reconnect to refresh it.
          </Text>
        ) : null}

        {failed ? (
          <EmptyState
            tone="error"
            title="Could not load today's work"
            body="You are offline and this device has not downloaded a list yet."
            action={<Button variant="secondary" icon="refresh-cw" onPress={() => void load()}>Try again</Button>}
          />
        ) : tasks === null ? (
          <EmptyState tone="loading" title="Loading today's work…" />
        ) : tasks.length === 0 ? (
          <EmptyState title="Nothing booked today" body="Walk-ins will appear here once an advisor books them." />
        ) : (
          tasks.map((task) => (
            <Card key={task.id} interactive onPress={onStartInspection} accessibilityLabel={`Open ${task.serviceTypeName} for ${task.vehiclePlateNo}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
                <Text style={{ ...t.text("code"), color: t.colors.ink }}>{manilaTime(task.scheduledStart)}</Text>
                <Plate variant="plain">{task.vehiclePlateNo}</Plate>
                <View style={{ flex: 1 }} />
                <StatusPill tone={STATUS_TONE[task.status] ?? "neutral"}>{task.status.replace("_", " ")}</StatusPill>
              </View>
              <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{task.serviceTypeName}</Text>
              {task.memberName ? (
                <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{task.memberName}</Text>
              ) : null}
            </Card>
          ))
        )}

        <Button icon="wrench" onPress={onStartInspection} style={{ marginTop: t.spacing.sm }}>
          Start inspection
        </Button>
        <Button variant="secondary" icon="refresh-cw" onPress={onOpenSyncQueue}>
          {sync.pendingCount > 0 ? `Sync queue (${sync.pendingCount})` : "Sync queue"}
        </Button>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- TaskListScreen.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Wire it as the Home route and delete StaffHomeScreen**

In `apps/field/src/app/App.tsx`, replace the `StaffHomeScreen` import with:

```tsx
import { TaskListScreen } from "../features/tasks/TaskListScreen";
```

and swap the component inside the `Home` screen's render callback:

```tsx
              <TaskListScreen
                name={boot.name}
                role={boot.role}
                onStartInspection={() => navigation.navigate("Inspection")}
                onOpenSyncQueue={() => navigation.navigate("SyncQueue")}
              />
```

Then delete the old screen:

```bash
rm apps/field/src/features/home/StaffHomeScreen.tsx
rmdir apps/field/src/features/home 2>/dev/null || true
```

- [ ] **Step 7: Verify nothing still references the deleted screen**

Run: `cd apps/field && grep -rn "StaffHomeScreen" src || echo "clean"`
Expected: `clean`.

Run: `cd apps/field && pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A apps/field/src
git commit -m "feat(field): replace the staff home screen with today's task list

The mockup's landing screen is the mechanic's day, not a 'signed in as'
card. Reads the Phase 3 board endpoint (MECHANIC is already inside
STAFF_ROLES) and caches it so an offline bay still shows this morning's
work behind a last-known marker.

Day-scoped, not mechanic-scoped: closing that needs an assignedMechanicId
on Appointment and a GET /field/tasks endpoint. Recorded as owed."
```

---

### Task 8: Re-skin CategoryNavScreen

**Files:**
- Modify: `apps/field/src/features/inspection/CategoryNavScreen.tsx` (whole file)
- Modify: `apps/field/src/features/inspection/InspectionFlow.tsx` (pass `onBack`)

**Interfaces:**
- Consumes: `Card`, `Button`, `FieldNav`, `Icon`, `fieldTheme`, `CategoryProgress` from `./draft`.
- Produces: `CategoryNavScreen({ perCategory, overall, onOpenCategory, onReview, onBack? })` — adds `onBack` to the existing signature.

- [ ] **Step 1: Write the failing test**

Create `apps/field/src/features/inspection/CategoryNav.test.tsx`:

```tsx
import { render, fireEvent, screen } from "@testing-library/react-native";
import { CategoryNavScreen } from "./CategoryNavScreen";

const perCategory = [
  { code: "BRK", label: "Brakes", labelFil: "Preno", answered: 3, total: 4, worst: "ATTENTION" as const },
  { code: "TYR", label: "Tyres & wheels", labelFil: "Gulong", answered: 6, total: 6, worst: "GOOD" as const },
];

describe("CategoryNavScreen", () => {
  it("shows overall progress in words, not just a bar", () => {
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={jest.fn()} onReview={jest.fn()} />);
    expect(screen.getByText("9 of 10 points recorded")).toBeTruthy();
  });

  it("carries the Filipino label alongside the English one", () => {
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={jest.fn()} onReview={jest.fn()} />);
    expect(screen.getByText("Preno")).toBeTruthy();
  });

  it("opens a category", () => {
    const onOpenCategory = jest.fn();
    render(<CategoryNavScreen perCategory={perCategory} overall={{ answered: 9, total: 10 }} onOpenCategory={onOpenCategory} onReview={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Brakes: 3 of 4 done"));
    expect(onOpenCategory).toHaveBeenCalledWith("BRK");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- CategoryNav.test.tsx`
Expected: FAIL — `Unable to find an element with text: 9 of 10 points recorded`.

- [ ] **Step 3: Implement**

Replace `apps/field/src/features/inspection/CategoryNavScreen.tsx`:

```tsx
import { ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { Icon } from "../../components/Icon";
import { statusColor } from "../../components/StatusChip";
import type { CategoryProgress } from "./draft";

/** Tile accent tracks the worst finding recorded so far — band tokens only. */
function worstColor(worst: PointStatus | null): string {
  return worst ? statusColor(worst) : fieldTheme.colors.line;
}

/** F-05 — category tiles with progress; the accent edge carries the worst
 *  finding so far so a mechanic can see where the trouble is at a glance. */
export function CategoryNavScreen({
  perCategory, overall, onOpenCategory, onReview, onBack,
}: {
  perCategory: CategoryProgress[];
  overall: { answered: number; total: number };
  onOpenCategory(code: string): void;
  onReview(): void;
  onBack?(): void;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : (overall.answered / overall.total) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Inspection" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
          {overall.answered} of {overall.total} points recorded
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: overall.total, now: overall.answered }}
          style={{ height: 8, borderRadius: t.radii.pill, backgroundColor: t.colors.line, overflow: "hidden" }}
        >
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: t.colors.primary }} />
        </View>

        {perCategory.map((cat) => {
          const done = cat.answered === cat.total;
          return (
            <Card
              key={cat.code}
              interactive
              accessibilityLabel={`${cat.label}: ${cat.answered} of ${cat.total} done`}
              onPress={() => onOpenCategory(cat.code)}
              accent={worstColor(cat.worst)}
              style={{ minHeight: t.minTarget, flexDirection: "row", alignItems: "center", gap: t.spacing.md }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.text("h2"), color: t.colors.ink }}>{cat.label}</Text>
                {cat.labelFil ? (
                  <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{cat.labelFil}</Text>
                ) : null}
              </View>
              <Text style={{ ...t.text("code"), color: done ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }}>
                {cat.answered}/{cat.total}
              </Text>
              <Icon name="chevron-right" size={22} color={t.colors.inkMuted} />
            </Card>
          );
        })}

        <Button icon="clipboard-check" onPress={onReview} style={{ marginTop: t.spacing.sm }}>
          Review &amp; submit
        </Button>
      </ScrollView>
    </View>
  );
}
```

If `CategoryProgress` in `./draft` has no `labelFil`, add it as `labelFil?: string` there and populate it from the cached checklist category in `useInspectionDraft.ts` — the checklist already carries Filipino labels.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- CategoryNav.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Pass the back handler from the flow**

In `apps/field/src/features/inspection/InspectionFlow.tsx`, add `onBack` to the `CategoryNavScreen` usage, wiring it to whatever the flow uses to leave the inspection (the existing `onDone` prop is correct if there is no intermediate step).

- [ ] **Step 6: Commit**

```bash
git add apps/field/src/features/inspection
git commit -m "feat(field): re-skin category nav to the mockup

Trades the invented primaryDeep block header for FieldNav, and adds the
progress bar, Filipino sub-labels, mono counts and chevrons the mockup
has. The accent edge now uses the borders.accentRow token (5) instead of
a hardcoded 6."
```

---

### Task 9: Re-skin PointEntryScreen

The screen closest to the mockup already. This swaps in the primitives and adds the photo-attached confirmation card. **Every existing PointEntry test must stay green** — see Global Constraints.

**Files:**
- Modify: `apps/field/src/features/inspection/PointEntryScreen.tsx` (whole file)

**Interfaces:**
- Consumes: `FieldNav`, `Button`, `Card`, `Icon`, `StatusChip`, `StatusChoice`, `STATUS_LABELS`, `FormField`.
- Produces: `PointEntryScreen` — same props as today plus optional `onBack` and `title`.

- [ ] **Step 1: Run the existing tests first to establish the baseline**

Run: `cd apps/field && pnpm test -- PointEntry.test.tsx`
Expected: PASS, the current 6 tests. Note them — they must still pass at the end.

- [ ] **Step 2: Add the failing test for the photo confirmation**

Append to `apps/field/src/features/inspection/PointEntry.test.tsx`, inside the existing `describe`:

```tsx
  it("confirms an attached photo so the mechanic knows it took", () => {
    render(
      <PointEntryScreen
        point={measuredPoint}
        initial={{ pointCode: "BRK-01", status: "ATTENTION", photoUris: ["file:///a.jpg"] }}
        onSave={jest.fn()}
        onAddPhoto={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    expect(screen.getByText("1 photo attached")).toBeTruthy();
  });
```

Reuse whatever fixture name the existing file already defines for a measured point — if it is not `measuredPoint`, match the local name.

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- PointEntry.test.tsx`
Expected: FAIL on the new case only.

- [ ] **Step 4: Implement**

Replace the render body of `apps/field/src/features/inspection/PointEntryScreen.tsx`. Keep the whole logic block above the `return` exactly as it is — only the markup changes:

```tsx
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title={title ?? point.label} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
        <View>
          <Text style={{ ...t.text("h1"), color: t.colors.ink }}>{point.label}</Text>
          {point.labelFil ? (
            <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>{point.labelFil}</Text>
          ) : null}
        </View>

        {point.inputType === "MEASURED" && (
          <View style={{ gap: t.spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <FormField
                  accessibilityLabel={`${point.label} measured value`}
                  keyboardType="decimal-pad"
                  value={value}
                  onChangeText={setValue}
                  placeholder="0.0"
                />
              </View>
              <Text style={{ ...t.text("h2"), color: t.colors.inkMuted }}>{point.unit}</Text>
            </View>
            {derived && <StatusChip status={derived} testID="derived-status-chip" />}
          </View>
        )}

        <View style={{ gap: t.spacing.sm }}>
          {STATUSES.map((s) => (
            <StatusChoice
              key={s}
              status={s}
              selected={effective === s}
              disabled={point.inputType === "MEASURED" && derived !== undefined && derived !== s}
              onPress={() => pick(s)}
            />
          ))}
        </View>

        {needsPhoto && (
          <Button variant="danger" icon="camera" accessibilityLabel="Add photo (required)" onPress={onAddPhoto}>
            Add photo — required for this finding
          </Button>
        )}

        {photoUris.length > 0 && (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <Icon name="image" size={22} color={t.vhsBands.EXCELLENT.fill} />
            <Text style={{ ...t.text("body"), color: t.colors.ink }}>
              {photoUris.length} photo{photoUris.length === 1 ? "" : "s"} attached
            </Text>
          </Card>
        )}

        <FormField
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          multiline
        />

        <Button
          accessibilityLabel="Save and next"
          disabled={effective === undefined || needsPhoto}
          onPress={() => { save(); onNext(); }}
        >
          Save &amp; next
        </Button>
      </ScrollView>
    </View>
  );
```

Add `onBack?(): void` and `title?: string` to `PointEntryProps`, import the primitives, and delete the now-unused local `statusColor` and `STATUS_LABELS` — they live in `StatusChip.tsx` now. Keep the `STATUSES` array.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- PointEntry.test.tsx && pnpm typecheck`
Expected: PASS, 7 tests — the 6 originals plus the new one. If `derived-status-chip` fails, `StatusChip` is not forwarding `testID`.

- [ ] **Step 6: Commit**

```bash
git add apps/field/src/features/inspection
git commit -m "feat(field): re-skin point entry onto the shared primitives

Swaps the hand-rolled chips for StatusChoice/StatusChip, adds the FieldNav
header and the photo-attached confirmation card, and retires the emoji
camera. The local status colour and label maps move to StatusChip."
```

---

### Task 10: Re-skin ReviewSubmitScreen

The biggest structural change: the mockup lists **every** point with its measured value and threshold, where the app lists only the missing and adverse subsets. **The existing ReviewSubmit tests must stay green** — in particular the text `Front pads — Needs attention` and `Score will appear when synced`, and the labels `Submit inspection` and `Complete Discs`.

**Files:**
- Modify: `apps/field/src/features/inspection/ReviewSubmitScreen.tsx` (whole file)

**Interfaces:**
- Consumes: `FieldNav`, `Card`, `Button`, `Plate`, `StatusPill`, `StatusChip`, `STATUS_LABELS`.
- Produces: `ReviewSubmitScreen` — same props plus optional `onBack` and `vehicle?: { plateNo: string; description?: string; odometerKm?: number }`.

- [ ] **Step 1: Run the existing tests to establish the baseline**

Run: `cd apps/field && pnpm test -- ReviewSubmit.test.tsx`
Expected: PASS, the current tests.

- [ ] **Step 2: Add the failing tests**

Append inside the existing `describe` in `apps/field/src/features/inspection/ReviewSubmit.test.tsx`:

```tsx
  it("lists every point with its measurement and threshold, not just the problems", () => {
    renderScreen(); // use whatever helper the file already defines
    expect(screen.getByText(/3 mm · good ≥ 5 mm/)).toBeTruthy();
  });

  it("says where a submission goes so an offline mechanic is not left guessing", () => {
    renderScreen();
    expect(screen.getByText(/Submits to the outbox/)).toBeTruthy();
  });
```

Match the existing file's render helper and fixture names; if it renders inline rather than via a helper, inline these the same way. The threshold fixture must have a measured point with value 3 and a good threshold of 5.

- [ ] **Step 3: Run them to verify they fail**

Run: `cd apps/field && pnpm test -- ReviewSubmit.test.tsx`
Expected: FAIL on the two new cases.

- [ ] **Step 4: Implement**

Replace `apps/field/src/features/inspection/ReviewSubmitScreen.tsx`:

```tsx
import { ScrollView, Text, View } from "react-native";
import type { PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Plate } from "../../components/Plate";
import { StatusPill } from "../../components/StatusPill";
import { StatusChip, STATUS_LABELS } from "../../components/StatusChip";
import { FieldNav } from "../../components/FieldNav";
import type { LocalResult } from "../../shared/db/inspections.repo";
import type { CachedChecklist, Completeness } from "./draft";

const ADVERSE: PointStatus[] = ["ATTENTION", "CRITICAL"];

/** F-08 — the whole inspection at a glance before it leaves the device:
 *  every point with what was measured, what is still missing, and what the
 *  advisor will need to talk about. */
export function ReviewSubmitScreen({
  checklist, results, check, overall, isOffline, submitted, vehicle, onJumpToPoint, onSubmit, onBack,
}: {
  checklist: CachedChecklist;
  results: LocalResult[];
  check: Completeness;
  overall: { answered: number; total: number };
  isOffline?: boolean;
  submitted?: boolean;
  vehicle?: { plateNo: string; description?: string; odometerKm?: number };
  onJumpToPoint(code: string): void;
  onSubmit(): void;
  onBack?(): void;
}) {
  const t = fieldTheme;
  const pct = overall.total === 0 ? 0 : Math.round((overall.answered / overall.total) * 100);
  const allPoints = checklist.categories.flatMap((c) => c.points);
  const labelFor = (code: string) => allPoints.find((p) => p.code === code)?.label ?? code;
  const resultFor = (code: string) => results.find((r) => r.pointCode === code);
  const adverse = results.filter((r) => r.status && ADVERSE.includes(r.status as PointStatus));

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Review &amp; submit" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        {vehicle ? (
          <Card style={{ gap: t.spacing.xs }}>
            <Plate variant="plain">{vehicle.plateNo}</Plate>
            {vehicle.description || vehicle.odometerKm !== undefined ? (
              <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>
                {[vehicle.description, vehicle.odometerKm !== undefined ? `${vehicle.odometerKm.toLocaleString("en-PH")} km` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Text
          accessibilityLabel={`Completion ${pct} percent`}
          style={{ ...t.text("h2"), color: check.complete ? t.vhsBands.EXCELLENT.text : t.colors.inkMuted }}
        >
          {pct}% complete ({overall.answered}/{overall.total})
        </Text>

        {allPoints.map((p) => {
          const r = resultFor(p.code);
          const status = r?.status as PointStatus | undefined;
          const threshold = p.thresholds?.good;
          return (
            <Card key={p.code} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm, minHeight: t.minTarget }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>{p.label}</Text>
                {r?.measuredValue !== undefined && threshold !== undefined ? (
                  <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>
                    {r.measuredValue} {p.unit} · good ≥ {threshold} {p.unit}
                  </Text>
                ) : null}
              </View>
              {status ? <StatusChip status={status} /> : <StatusPill tone="warn">NOT RECORDED</StatusPill>}
            </Card>
          );
        })}

        {(check.missingPoints.length > 0 || check.missingPhotos.length > 0) && (
          <Card accent={t.vhsBands.NEEDS_ATTENTION.fill} style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>
              {check.missingPoints.length + check.missingPhotos.length} still to record
            </Text>
            {check.missingPoints.map((code) => (
              <Text
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`Complete ${labelFor(code)}`}
                onPress={() => onJumpToPoint(code)}
                style={{ ...t.text("body"), color: t.colors.primary, minHeight: 44 }}
              >
                {labelFor(code)} — not answered
              </Text>
            ))}
            {check.missingPhotos.map((code) => (
              <Text
                key={code}
                accessibilityRole="button"
                accessibilityLabel={`Add photo for ${labelFor(code)}`}
                onPress={() => onJumpToPoint(code)}
                style={{ ...t.text("body"), color: t.colors.danger, minHeight: 44 }}
              >
                {labelFor(code)} — photo required
              </Text>
            ))}
          </Card>
        )}

        {adverse.length > 0 && (
          <View style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Findings to discuss</Text>
            {adverse.map((r) => (
              <Card key={r.pointCode}>
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>
                  {labelFor(r.pointCode)} — {r.status === "CRITICAL" ? "Critical" : "Needs attention"}
                  {r.measuredValue !== undefined ? ` (${r.measuredValue})` : ""}
                </Text>
                {r.notes ? <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{r.notes}</Text> : null}
              </Card>
            ))}
          </View>
        )}

        {submitted ? (
          <Card>
            <Text style={{ ...t.text("h2"), color: t.colors.ink }}>Submitted</Text>
            {isOffline ? (
              <Text style={{ ...t.text("body"), color: t.colors.inkMuted }}>Score will appear when synced.</Text>
            ) : null}
          </Card>
        ) : (
          <>
            <Button accessibilityLabel="Submit inspection" disabled={!check.complete} onPress={onSubmit}>
              Submit inspection
            </Button>
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
              Submits to the outbox — it will sync when you have signal.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
```

Note the `Submitted ✓` heading loses its emoji check — the card shape already carries the "done" meaning.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- ReviewSubmit.test.tsx && pnpm typecheck`
Expected: PASS — all original cases plus the 2 new ones. If `Front pads — Needs attention` fails, the adverse block's text was altered; restore it exactly.

- [ ] **Step 6: Pass the vehicle through from the flow**

In `apps/field/src/features/inspection/InspectionFlow.tsx`, pass `vehicle` to `ReviewSubmitScreen` if the flow already holds the vehicle for the inspection. If it does not, leave the prop unset — it is optional and the card simply does not render.

- [ ] **Step 7: Commit**

```bash
git add apps/field/src/features/inspection
git commit -m "feat(field): re-skin review & submit to the full point list

The mockup shows every point with what was measured against its threshold,
not just the problems — a mechanic reviewing before submit needs to see
what they recorded, not only what they missed. Adds the vehicle card, the
accent summary of what is outstanding, and the outbox explanation."
```

---

### Task 11: Re-skin ScoreResultScreen

**Files:**
- Modify: `apps/field/src/features/inspection/ScoreResultScreen.tsx` (whole file)

**Interfaces:**
- Consumes: `ScoreGauge` (Task 5), `Card`, `Button`, `StatusChip`, `FieldNav`.
- Produces: `ScoreResultScreen({ result?, offline?, onBackToTasks? })`. `FieldScore` gains two optional fields: `averagedScore?: number` and `confidence?: "HIGH" | "MEDIUM" | "LOW"`; `topDetractors[]` entries gain `status: PointStatus` and optional `estimatedCostCentavos?: number`.

- [ ] **Step 1: Write the failing test**

Create `apps/field/src/features/inspection/ScoreResult.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { ScoreResultScreen } from "./ScoreResultScreen";

const result = {
  score: 69,
  band: "FAIR" as const,
  overrideApplied: "SAFETY_CRITICAL",
  averagedScore: 84.5,
  confidence: "MEDIUM" as const,
  topDetractors: [
    { label: "Front brake pad replacement", status: "CRITICAL" as const, recommendation: "Replace the pads", estimatedCostCentavos: 320000 },
  ],
};

describe("ScoreResultScreen", () => {
  it("explains a capped score with the numbers behind it", () => {
    render(<ScoreResultScreen result={result} />);
    expect(screen.getByText(/Averaged 84.5 · capped at 69/)).toBeTruthy();
  });

  it("prices each recommendation so the advisor can quote it", () => {
    render(<ScoreResultScreen result={result} />);
    expect(screen.getByText("est. ₱3,200")).toBeTruthy();
  });

  it("waits for the score rather than showing a wrong one", () => {
    render(<ScoreResultScreen offline />);
    expect(screen.getByText(/Score will appear once this device syncs/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- ScoreResult.test.tsx`
Expected: FAIL — the explanation and price strings are not rendered.

- [ ] **Step 3: Implement**

Replace `apps/field/src/features/inspection/ScoreResultScreen.tsx`:

```tsx
import { ScrollView, Text, View } from "react-native";
import type { Band, PointStatus } from "@autocare/scoring";
import { fieldTheme } from "../../theme";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { FieldNav } from "../../components/FieldNav";
import { ScoreGauge } from "../../components/ScoreGauge";
import { StatusChip, statusColor } from "../../components/StatusChip";

export type FieldScore = {
  score: number;
  band: Band;
  overrideApplied: string;
  /** The pre-override average, shown so the mechanic can explain the cap. */
  averagedScore?: number;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  topDetractors: Array<{
    label: string;
    status: PointStatus;
    recommendation: string;
    estimatedCostCentavos?: number;
  }>;
};

const peso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString("en-PH")}`;

/** F-09 — the gauge plus what to tell the customer. Shown once a submitted
 *  inspection syncs and returns its score. */
export function ScoreResultScreen({
  result, offline, onBackToTasks,
}: {
  result?: FieldScore;
  offline?: boolean;
  onBackToTasks?: () => void;
}) {
  const t = fieldTheme;

  if (!result) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
        <FieldNav title="Score result" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: t.spacing.lg }}>
          <Text style={{ ...t.text("h1"), color: t.colors.ink, textAlign: "center" }}>Inspection submitted</Text>
          <Text style={{ ...t.text("body"), color: t.colors.inkMuted, textAlign: "center", marginTop: t.spacing.sm }}>
            {offline ? "Score will appear once this device syncs." : "Computing score…"}
          </Text>
        </View>
      </View>
    );
  }

  const capped = result.overrideApplied !== "NONE" && result.averagedScore !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Score result" />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.md }}>
        <Card pad="lg" style={{ alignItems: "center", gap: t.spacing.sm }}>
          <ScoreGauge score={result.score} band={result.band} size={240} confidence={result.confidence} />
          {capped ? (
            <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
              Averaged {result.averagedScore} · capped at {Math.round(result.score)} by a safety-critical finding
            </Text>
          ) : null}
        </Card>

        <Text style={{ ...t.text("h1"), color: t.colors.ink }}>What to tell the customer</Text>

        {result.overrideApplied !== "NONE" && (
          <Card accent={t.colors.danger}>
            <Text style={{ ...t.text("body"), color: t.colors.danger }}>
              A safety-critical item {result.overrideApplied === "SAFETY_CRITICAL" ? "is in unsafe condition" : "needs attention"} — explain the score is capped until it is fixed.
            </Text>
          </Card>
        )}

        {result.topDetractors.map((d, i) => (
          <Card key={i} accent={statusColor(d.status)} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.text("body"), color: t.colors.ink }}>{d.label}</Text>
              <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>{d.recommendation}</Text>
              {d.estimatedCostCentavos !== undefined ? (
                <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>est. {peso(d.estimatedCostCentavos)}</Text>
              ) : null}
            </View>
            <StatusChip status={d.status} />
          </Card>
        ))}

        {onBackToTasks ? (
          <Button variant="secondary" onPress={onBackToTasks}>Back to today's tasks</Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- ScoreResult.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Wire the back action**

In `apps/field/src/features/inspection/InspectionFlow.tsx`, pass `onBackToTasks={onDone}` to `ScoreResultScreen`. If `topDetractors` from the API lacks `status` or `estimatedCostCentavos`, map what is available and leave the rest undefined — both render conditionally.

- [ ] **Step 6: Commit**

```bash
git add apps/field/src/features/inspection
git commit -m "feat(field): re-skin the score result onto ScoreGauge

Adds the confidence indicator, the averaged-vs-capped explanation with
its real numbers, and per-recommendation cost and severity — the three
things the mockup gives a mechanic to explain a capped score with."
```

---

### Task 12: Re-skin SyncQueueScreen

**Files:**
- Modify: `apps/field/src/features/sync/SyncQueueScreen.tsx` (whole file)

**Interfaces:**
- Consumes: `Card`, `Button`, `StatusPill`, `EmptyState`, `FieldNav`, `Icon` / `IconName`.
- Produces: `SyncQueueScreen({ storageUsedBytes?, onBack? })`.

- [ ] **Step 1: Write the failing test**

Create `apps/field/src/features/sync/SyncQueueScreen.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import { SyncQueueScreen } from "./SyncQueueScreen";
import { outbox } from "../../shared/sync";

jest.mock("../../shared/sync", () => ({
  outbox: { pendingInOrder: jest.fn(), rejectedInOrder: jest.fn() },
  syncProcessor: { subscribe: jest.fn(() => () => {}), drain: jest.fn(), status: { pendingCount: 1, rejectedCount: 0, isDraining: false } },
}));

jest.mock("../../shared/sync/useSyncStatus", () => ({
  useSyncStatus: () => ({ pendingCount: 1, rejectedCount: 0, isDraining: false, lastSyncAt: null }),
}));

describe("SyncQueueScreen", () => {
  it("shows each queued item with its state", async () => {
    (outbox.pendingInOrder as jest.Mock).mockResolvedValue([
      { clientUuid: "u1", entityType: "inspection", op: "create", createdAt: Date.now(), attempts: 0 },
    ]);
    (outbox.rejectedInOrder as jest.Mock).mockResolvedValue([]);
    render(<SyncQueueScreen />);
    await waitFor(() => expect(screen.getByText("QUEUED")).toBeTruthy());
  });

  it("reports an empty queue as a settled state, not a blank screen", async () => {
    (outbox.pendingInOrder as jest.Mock).mockResolvedValue([]);
    (outbox.rejectedInOrder as jest.Mock).mockResolvedValue([]);
    render(<SyncQueueScreen />);
    await waitFor(() => expect(screen.getByText("Everything is synced")).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/field && pnpm test -- SyncQueueScreen.test.tsx`
Expected: FAIL — `QUEUED` is not rendered (the current screen groups by entity instead).

- [ ] **Step 3: Implement**

Replace the render body of `apps/field/src/features/sync/SyncQueueScreen.tsx`, keeping the existing hooks and `refresh` logic. Replace the `ENTITY_ICONS` emoji map with icon names and flatten the grouped list:

```tsx
const ENTITY_ICONS: Record<string, IconName> = {
  inspection: "wrench",
  waste_record: "droplet",
  trip_status: "truck",
  trip_condition: "clipboard-list",
  payment_cash: "banknote",
};

const entityLabel = (entityType: string) =>
  entityType.replace("_", " ").replace(/^./, (c) => c.toUpperCase());
```

and the returned tree:

```tsx
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.chassis }}>
      <FieldNav title="Sync queue" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.md, gap: t.spacing.sm }}>
        <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
          {status.pendingCount} pending · {status.rejectedCount} needs attention
          {status.lastSyncAt ? ` · last sync ${age(status.lastSyncAt)} ago` : ""}
        </Text>

        {pending.map((e) => (
          <Card key={e.clientUuid} style={{ flexDirection: "row", alignItems: "center", gap: t.spacing.sm, minHeight: t.minTarget }}>
            <Icon name={ENTITY_ICONS[e.entityType] ?? "package"} size={22} color={t.colors.inkMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.text("body"), color: t.colors.ink }}>{entityLabel(e.entityType)} · {e.op}</Text>
              <Text style={{ ...t.text("code"), color: t.colors.inkMuted }}>{age(e.createdAt)} old</Text>
            </View>
            <StatusPill tone={e.attempts > 0 ? "warn" : "neutral"}>
              {e.attempts > 0 ? "RETRYING" : "QUEUED"}
            </StatusPill>
          </Card>
        ))}

        {pending.length === 0 && rejected.length === 0 ? (
          <EmptyState title="Everything is synced" body="Nothing is waiting to leave this device." />
        ) : null}

        {rejected.length > 0 && (
          <View style={{ gap: t.spacing.xs }}>
            <Text style={{ ...t.text("h2"), color: t.colors.danger }}>Needs attention</Text>
            {rejected.map((e) => (
              <Card
                key={e.clientUuid}
                accent={t.colors.danger}
                interactive
                accessibilityLabel={`${entityLabel(e.entityType)} rejected by server`}
                onPress={() => setExpanded(expanded === e.clientUuid ? null : e.clientUuid)}
                style={{ minHeight: t.minTarget, justifyContent: "center" }}
              >
                <Text style={{ ...t.text("body"), color: t.colors.ink }}>
                  {entityLabel(e.entityType)} · {e.op} · rejected by server
                </Text>
                {expanded === e.clientUuid && (
                  <View style={{ paddingTop: t.spacing.xs }}>
                    <Text style={{ ...t.text("label"), color: t.colors.danger }}>{e.lastError}</Text>
                    <Text style={{ ...t.text("label"), color: t.colors.inkMuted }}>
                      This record was not accepted. Contact your advisor to resolve it.
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        <Button
          variant="secondary"
          icon="refresh-cw"
          disabled={status.isDraining}
          accessibilityLabel="Sync now"
          onPress={() => { void syncProcessor.drain(); }}
        >
          {status.isDraining ? "Syncing…" : "Retry now"}
        </Button>

        <Text style={{ ...t.text("label"), color: t.colors.inkMuted, textAlign: "center" }}>
          Local queue storage: {(storageUsedBytes / 1024).toFixed(0)} KB
        </Text>
      </ScrollView>
    </View>
  );
```

The `groups` Map and its `for` loop are now dead — delete them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/field && pnpm test -- SyncQueueScreen.test.tsx && pnpm typecheck`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/field/src/features/sync
git commit -m "feat(field): flatten the sync queue onto cards and pills

Each entry now carries its own state pill instead of being grouped under
an emoji heading, and the empty queue reads as settled rather than blank."
```

---

### Task 13: Re-skin WasteEntry, PhotoAnnotate and StaffLogin

The last three screens. **WasteEntry's existing test asserts `getByLabelText("Used oil").props.style.minHeight >= 56`** — the waste type selector must therefore keep a directly-styled pressable with a `minHeight`, not a wrapped `Button`.

**Files:**
- Modify: `apps/field/src/features/waste/WasteEntryScreen.tsx`
- Modify: `apps/field/src/features/inspection/PhotoAnnotateScreen.tsx`
- Modify: `apps/field/src/features/auth/StaffLoginScreen.tsx`

**Interfaces:**
- Consumes: `Card`, `Button`, `FormField`, `FieldNav`, `Icon`.
- Produces: no signature changes.

- [ ] **Step 1: Run the existing waste tests to establish the baseline**

Run: `cd apps/field && pnpm test -- WasteEntryScreen.test.tsx`
Expected: PASS, the current 2 tests.

- [ ] **Step 2: Re-skin WasteEntryScreen**

Replace the emoji `icon` field in the waste-type array with `IconName` values and render them through `Icon`:

```tsx
const WASTE_TYPES: Array<{ type: string; label: string; unit: string; icon: IconName }> = [
  { type: "USED_OIL", label: "Used oil", unit: "L", icon: "droplet" },
  { type: "COOLANT", label: "Coolant", unit: "L", icon: "droplet" },
  { type: "BATTERY", label: "Battery", unit: "pcs", icon: "battery" },
  { type: "FILTER", label: "Filter", unit: "pcs", icon: "filter" },
  { type: "TIRE", label: "Tyre", unit: "pcs", icon: "circle-dot" },
];
```

Keep the type selector as a `Pressable` with an explicit `minHeight: t.minTarget` and `accessibilityLabel={w.label}` — the existing test reads that style directly. Swap the quantity input for `FormField` with `accessibilityLabel="Quantity"`, wrap the screen in `FieldNav title="Record waste"`, and make the submit a `Button` with `accessibilityLabel="Queue waste record"`.

- [ ] **Step 3: Run the waste tests to verify they still pass**

Run: `cd apps/field && pnpm test -- WasteEntryScreen.test.tsx`
Expected: PASS, 2 tests. If the `minHeight` assertion fails, the type selector was wrapped in a component that flattens its style — revert it to a direct `Pressable`.

- [ ] **Step 4: Re-skin PhotoAnnotateScreen**

Replace the two emoji labels with icons and `Button`:

- `↗ Arrow` becomes `<Button variant="secondary" icon="arrow-up-right" block={false}>Arrow</Button>`
- `Use photo ✓` becomes `<Button icon="check">Use photo</Button>`

Leave the camera and annotation canvas logic untouched — only the control markup changes.

- [ ] **Step 5: Re-skin StaffLoginScreen**

Replace the hand-rolled `TextInput`s with `FormField` (`label="Staff email"` and `label="Password"`, keeping `testID="staff-email"` and `testID="staff-password"`), and the submit `Pressable` with `Button` (keeping `testID="staff-login-submit"`). Pass the existing `error` string to the password `FormField`'s `error` prop so it renders in the field rather than as a floating line, and keep `testID="staff-login-error"` on that text. Switch the card radius from `radii.sm` to `radii.md` to match the design system's login treatment.

- [ ] **Step 6: Run the full suite**

Run: `cd apps/field && pnpm test && pnpm typecheck`
Expected: PASS — everything.

- [ ] **Step 7: Verify no emoji survive anywhere in the app**

Run:

```bash
cd apps/field && grep -rnP '[\x{1F300}-\x{1FAFF}\x{2190}-\x{21FF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]' src --include='*.tsx' || echo "no emoji remain"
```

Expected: `no emoji remain`.

- [ ] **Step 8: Commit**

```bash
git add apps/field/src
git commit -m "feat(field): re-skin waste entry, photo annotation and staff login

Retires the last of the emoji — the waste type glyphs, the annotation
arrow and the checkmarks — and puts login on FormField and Button."
```

---

### Task 14: Verify and record the pass

**Files:**
- Create: `docs/checkpoints/2026-08-28-field-design-system-fidelity.md`

- [ ] **Step 1: Run the full monorepo gate**

Run: `pnpm turbo run typecheck lint test`
Expected: every workspace green. If `apps/member` fails to typecheck on a missing `@testing-library/react-native`, a filtered add pruned its store link — run a root `pnpm install` and re-run.

- [ ] **Step 2: Count the field suite**

Run: `cd apps/field && pnpm test 2>&1 | tail -5`
Expected: the original 33 tests plus roughly 30 new ones, all passing.

- [ ] **Step 3: Confirm the design-system adoption actually landed**

Run:

```bash
cd apps/field && grep -rln "from \"\.\./\.\./components/\|from \"\.\./components/" src/features src/shared | wc -l
```

Expected: at least 8 — every feature screen now imports at least one primitive.

- [ ] **Step 4: Write the checkpoint**

Create `docs/checkpoints/2026-08-28-field-design-system-fidelity.md` recording: the font-registration root cause and fix; the primitive layer added; the screens re-skinned; the three flagged deviations (Inter for body, band-coloured status chips, day-scoped task list); and the work still owed — on-device Expo verification, and the `assignedMechanicId` + `GET /field/tasks` endpoint that would make the task list mechanic-scoped.

- [ ] **Step 5: Commit**

```bash
git add docs/checkpoints/2026-08-28-field-design-system-fidelity.md
git commit -m "docs: checkpoint the field design-system fidelity pass"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — §1 fonts → Task 1; §2 icons → Task 2; §3 primitives → Tasks 3–5 (core, support, inspection) and the SyncBanner upgrade → Task 6; §4 screens → Tasks 7–13, one row of the spec's screen table per task; §5 task list data source → Task 7 Step 3; §6 error handling → Task 7's `failed` / `stale` branches and their two tests; §7 testing → the test step opening every task plus the Task 14 gate.

**Type consistency:** `statusColor` and `STATUS_LABELS` are defined once in Task 5's `StatusChip.tsx` and imported by Tasks 8 (category accent), 9 (point entry), 10 (review) and 11 (score result) — no task redefines them. `FieldTask` is produced in Task 7 and consumed only there. `IconName` is produced in Task 2 and consumed in Tasks 3, 12 and 13. `Button` has no `size` prop in field (unlike member's), and no task passes one.

**Known brittleness carried deliberately:** three existing tests assert on `props.style` shape (`WasteEntryScreen`'s `minHeight`, and the new `Card` / `Button` / `FormField` target tests). Tasks 3, 4 and 13 each call this out where it constrains the implementation.
