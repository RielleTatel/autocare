# Staff Web Console Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web` the shared masthead chrome it has never had, put the shipped-but-unused component library to work, repair the work-order page's token and shadowing defects, and build the panels the mockup has.

**Architecture:** A `TopBar` applied through Next route-group layouts, so chrome is declared once rather than pasted per page. The existing `components/` library gains three token-driven additions (`BandChip`, `StarRating`, `CategoryBar`) needed by the health-score rail. Pages then adopt those primitives and gain their missing panels, each fetching independently so one failure never blanks a page.

**Tech Stack:** Next.js App Router, React, Tailwind (via `@autocare/design-tokens` preset), Vitest + Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-08-28-staff-web-console-fidelity-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-28-admin-analytics-waste-export.md` — Tasks 7 and 8 consume `GET /admin/analytics/summary`, `GET /admin/waste/summary` and `GET /scheduling/operating-hours`. Tasks 1–6 do not, and can proceed regardless.

## Global Constraints

- **Vitest needs explicit imports.** `apps/web` has no test globals in tsc — every test file must `import { describe, it, expect, vi } from "vitest"`.
- **Test files must sit under a path `vitest.config.ts` includes:** `app/**`, `components/**`, `lib/**`, or `middleware.*`.
- **Tokens, never raw hex.** Colours come from Tailwind classes backed by the preset (`text-ink`, `bg-primary`, `border-line`) or `var(--ac-*)`. A literal `#RRGGBB` in a component is a defect — `SEVERITY_COLOR` in the work-order page is exactly this and gets fixed.
- **Band colours are product data, never decoration** — they appear only when they mean a score or inspection status.
- **Elevation is hairlines, not shadow.** The only sanctioned shadow is the web login card (`--ac-elevation-raised`) and sheets over a scrim.
- **Touch targets are 48px on web** (`--ac-target-member`), not 44.
- **All API calls go through the BFF proxy** at `/api/proxy/<path>`, which attaches the httpOnly session cookie. Never call the API host directly from a client component.
- **Money renders mono + `tabular-nums`** so amount columns align down the page.
- **Never regress the existing suites** — `apps/web` currently has Board, component and lib tests that must stay green.

---

### Task 1: TopBar

The chrome every mockup screen wears and no page in the app has. Sign-out currently lives on `/staff` and `/admin` and is absent from `/staff/schedule` and the work-order page; it centralises here.

**Files:**
- Create: `apps/web/components/TopBar.tsx`
- Test: `apps/web/components/TopBar.test.tsx`

**Interfaces:**
- Produces: `TopBar({ consoleLabel, nav, active, onSignOut }: { consoleLabel: string; nav: Array<{ label: string; href: string }>; active?: string; onSignOut: () => void })`

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/TopBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

const nav = [
  { label: "Schedule", href: "/staff/schedule" },
  { label: "Work orders", href: "/staff/work-orders" },
  { label: "Admin", href: "/admin" },
];

describe("TopBar", () => {
  it("shows the brand and which console you are in", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} onSignOut={() => {}} />);
    expect(screen.getByText("AutoCare+")).toBeTruthy();
    expect(screen.getByText("advisor desk")).toBeTruthy();
  });

  it("renders every nav destination as a link", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} onSignOut={() => {}} />);
    expect(screen.getByRole("link", { name: "Schedule" }).getAttribute("href")).toBe("/staff/schedule");
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
  });

  it("marks the active destination for assistive tech, not just visually", () => {
    render(<TopBar consoleLabel="advisor desk" nav={nav} active="Schedule" onSignOut={() => {}} />);
    expect(screen.getByRole("link", { name: "Schedule" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("aria-current")).toBeNull();
  });

  it("signs out", () => {
    const onSignOut = vi.fn();
    render(<TopBar consoleLabel="admin console" nav={nav} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- TopBar`
Expected: FAIL — cannot resolve `./TopBar`.

- [ ] **Step 3: Implement**

Create `apps/web/components/TopBar.tsx`:

```tsx
"use client";

import Link from "next/link";

export interface TopBarProps {
  /** "advisor desk" / "admin console" — which console the user is standing in. */
  consoleLabel: string;
  nav: Array<{ label: string; href: string }>;
  active?: string;
  onSignOut: () => void;
}

/**
 * The staff masthead: deep-chrome bar, brand, console label, destinations, sign
 * out. Declared once and mounted from the route-group layouts so no page
 * re-implements its own header.
 */
export function TopBar({ consoleLabel, nav, active, onSignOut }: TopBarProps) {
  return (
    <header className="flex h-14 flex-none items-center gap-6 bg-primary-deep px-6">
      <span className="font-display text-[22px] font-semibold tracking-[0.01em] text-white">
        AutoCare+
      </span>
      <span
        className="font-mono text-xs uppercase tracking-[0.08em]"
        style={{ color: "var(--ac-on-deep-meta)" }}
      >
        {consoleLabel}
      </span>

      <nav className="ml-4 flex gap-1">
        {nav.map((n) => {
          const isActive = active === n.label;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              className="flex min-h-9 items-center rounded-sm px-3 text-sm font-medium transition-colors"
              style={
                isActive
                  ? { background: "rgba(255,255,255,0.12)", color: "#FFFFFF" }
                  : { color: "var(--ac-on-deep-body)" }
              }
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <span className="flex-1" />

      <button
        type="button"
        onClick={onSignOut}
        className="rounded-sm border px-3 py-2 text-sm text-white"
        style={{ borderColor: "rgba(255,255,255,0.3)" }}
      >
        Sign out
      </button>
    </header>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- TopBar`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/TopBar.tsx apps/web/components/TopBar.test.tsx
git commit -m "feat(web): add the staff masthead

The chrome every mockup screen has and no page had. Consumes the
--ac-on-deep-body/-meta tokens, which until now had no consumer."
```

---

### Task 2: Mount the chrome from route layouts

**Files:**
- Create: `apps/web/app/staff/layout.tsx`
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/components/StaffShell.tsx`
- Test: `apps/web/components/StaffShell.test.tsx`
- Modify: `apps/web/app/staff/page.tsx` (drop its local sign-out)
- Modify: `apps/web/app/admin/page.tsx` (drop its local header)

**Interfaces:**
- Consumes: `TopBar` (Task 1).
- Produces: `StaffShell({ consoleLabel, active, children }: { consoleLabel: string; active?: string; children: ReactNode })` — owns the sign-out call and page frame.

- [ ] **Step 1: Write the failing test**

Create `apps/web/components/StaffShell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StaffShell } from "./StaffShell";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("StaffShell", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("frames its children under the masthead", () => {
    render(<StaffShell consoleLabel="advisor desk"><p>Board</p></StaffShell>);
    expect(screen.getByText("AutoCare+")).toBeTruthy();
    expect(screen.getByText("Board")).toBeTruthy();
  });

  it("ends the session and returns to login on sign out", async () => {
    render(<StaffShell consoleLabel="advisor desk"><p>Board</p></StaffShell>);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(fetch).toHaveBeenCalledWith("/api/session", { method: "DELETE" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- StaffShell`
Expected: FAIL — cannot resolve `./StaffShell`.

- [ ] **Step 3: Implement the shell**

Create `apps/web/components/StaffShell.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";

const NAV = [
  { label: "Schedule", href: "/staff/schedule" },
  { label: "Capacity", href: "/staff/config" },
  { label: "Admin", href: "/admin" },
];

/**
 * Page frame for every signed-in staff surface. Sign-out lives here rather than
 * on individual pages, where it was previously duplicated twice and missing twice.
 */
export function StaffShell({
  consoleLabel, active, children,
}: {
  consoleLabel: string;
  active?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-chassis">
      <TopBar consoleLabel={consoleLabel} nav={NAV} active={active} onSignOut={signOut} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- StaffShell`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add the route layouts**

Create `apps/web/app/staff/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { StaffShell } from "../../components/StaffShell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell consoleLabel="advisor desk">{children}</StaffShell>;
}
```

Create `apps/web/app/admin/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { StaffShell } from "../../components/StaffShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StaffShell consoleLabel="admin console" active="Admin">{children}</StaffShell>;
}
```

- [ ] **Step 6: Strip the now-duplicated page chrome**

In `apps/web/app/staff/page.tsx`, delete the `signOut` function, the `useRouter` import and the Sign out button — the shell owns them. Keep the two navigation links. Remove the outer `min-h-screen ... bg-chassis` wrapper, since the shell supplies the frame; the page returns just its content.

In `apps/web/app/admin/page.tsx`, delete the `signOut` function, the `useRouter` import, and the Sign out button from its `<header>`. Keep the `<h1>` and the Checklists link. Replace the outer `<main className="min-h-screen bg-chassis px-6 py-6">` and its inner `max-w-3xl mx-auto` wrapper with a plain fragment — the shell supplies both.

Do the same de-duplication in `apps/web/app/staff/schedule/page.tsx` and `apps/web/app/staff/work-orders/[id]/page.tsx`: drop their `min-h-screen bg-chassis px-6 py-6` / `max-w-*  mx-auto` wrappers so content sits inside the shell's frame.

- [ ] **Step 7: Verify**

Run: `cd apps/web && pnpm test && pnpm typecheck`
Expected: PASS — existing suites plus the new ones; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "feat(web): mount shared chrome from route layouts

Sign-out was duplicated on /staff and /admin and missing from the
schedule board and work-order pages. It now lives in one shell that every
signed-in surface inherits."
```

---

### Task 3: Login onto the primitives

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Test: `apps/web/app/login/login.test.tsx`

**Interfaces:**
- Consumes: `FormField`, `Button` from `apps/web/components/`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/login/login.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../lib/auth/firebase", () => ({ signInStaff: vi.fn() }));

import LoginPage from "./page";

describe("Login", () => {
  it("meets the 48px web touch target on its inputs", () => {
    const { container } = render(<LoginPage />);
    const email = container.querySelector("input[type=email]");
    expect(email?.className).toContain("h-12");
  });

  it("keeps the staff-only notice", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Staff access only/)).toBeTruthy();
  });

  it("disables sign-in until both fields are filled", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- login`
Expected: FAIL on the `h-12` assertion — inputs are currently `h-11`.

- [ ] **Step 3: Implement**

In `apps/web/app/login/page.tsx`: import `Button` from `../../components/Button`, replace the card's `shadow-sm` with the raised elevation token, take the inputs to `h-12`, and swap the submit for `Button`.

The card wrapper becomes:

```tsx
      <div
        className="w-full max-w-sm rounded-md border border-line bg-surface p-8"
        style={{ boxShadow: "var(--ac-elevation-raised)" }}
      >
```

Each input's class becomes `mt-1 w-full h-12 rounded-sm border border-line px-3 text-ink`.

The submit becomes:

```tsx
          <Button type="submit" block disabled={submitting || !email || !password}>
            Sign in
          </Button>
```

Keep the existing `onSubmit`, error handling and copy exactly as they are — only the presentation changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- login && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/login
git commit -m "feat(web): put login on Button and the elevation token

Inputs go to the 48px web target; the card uses --ac-elevation-raised
rather than Tailwind's shadow-sm."
```

---

### Task 4: Score components — BandChip, StarRating, CategoryBar

The health-score rail needs these three and they exist only in React Native today.

**Files:**
- Create: `apps/web/components/BandChip.tsx`, `StarRating.tsx`, `CategoryBar.tsx`
- Test: `apps/web/components/BandChip.test.tsx`, `StarRating.test.tsx`, `CategoryBar.test.tsx`

**Interfaces:**
- Produces:
  - `BandChip({ band }: { band: BandName })` — `BandName = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL"`
  - `StarRating({ band, size }: { band: BandName; size?: number })`
  - `CategoryBar({ label, score, compact }: { label: string; score: number; compact?: boolean })`
  - `starsForBand(band: BandName): 1 | 2 | 3 | 4 | 5` and `bandVar(band: BandName): string`, both exported from `BandChip.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/components/BandChip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BandChip, starsForBand, bandVar } from "./BandChip";

describe("BandChip", () => {
  it("names the band in words, not the enum", () => {
    render(<BandChip band="NEEDS_ATTENTION" />);
    expect(screen.getByText("Needs Attention")).toBeTruthy();
  });

  it("uses the protected band token, never a raw hex", () => {
    expect(bandVar("CRITICAL")).toBe("var(--ac-band-critical)");
    expect(bandVar("FAIR")).toBe("var(--ac-band-fair)");
  });

  it("maps each band to its star count", () => {
    expect(starsForBand("EXCELLENT")).toBe(5);
    expect(starsForBand("GOOD")).toBe(4);
    expect(starsForBand("FAIR")).toBe(3);
    expect(starsForBand("NEEDS_ATTENTION")).toBe(2);
    expect(starsForBand("CRITICAL")).toBe(1);
  });
});
```

Create `apps/web/components/StarRating.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "./StarRating";

describe("StarRating", () => {
  it("states the rating in text for assistive tech", () => {
    render(<StarRating band="GOOD" />);
    expect(screen.getByLabelText("4 out of 5 stars")).toBeTruthy();
  });

  it("draws five stars regardless of the score", () => {
    const { container } = render(<StarRating band="CRITICAL" />);
    expect(container.querySelectorAll("svg").length).toBe(5);
  });
});
```

Create `apps/web/components/CategoryBar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBar } from "./CategoryBar";

describe("CategoryBar", () => {
  it("labels the category and its score", () => {
    render(<CategoryBar label="Brakes" score={55} />);
    expect(screen.getByText("Brakes")).toBeTruthy();
    expect(screen.getByText("55")).toBeTruthy();
  });

  it("exposes the score as a progress value", () => {
    render(<CategoryBar label="Brakes" score={55} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("55");
  });

  it("clamps a score outside 0-100 rather than overflowing its track", () => {
    render(<CategoryBar label="Engine" score={140} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/web && pnpm test -- BandChip StarRating CategoryBar`
Expected: FAIL — none of the three modules resolve.

- [ ] **Step 3: Implement BandChip**

Create `apps/web/components/BandChip.tsx`:

```tsx
export type BandName = "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS_ATTENTION" | "CRITICAL";

const LABEL: Record<BandName, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_ATTENTION: "Needs Attention",
  CRITICAL: "Critical",
};

const VAR: Record<BandName, string> = {
  EXCELLENT: "var(--ac-band-excellent)",
  GOOD: "var(--ac-band-good)",
  FAIR: "var(--ac-band-fair)",
  NEEDS_ATTENTION: "var(--ac-band-attention)",
  CRITICAL: "var(--ac-band-critical)",
};

const STARS: Record<BandName, 1 | 2 | 3 | 4 | 5> = {
  EXCELLENT: 5, GOOD: 4, FAIR: 3, NEEDS_ATTENTION: 2, CRITICAL: 1,
};

/** The protected band fill for a band. Never inline a band hex — use this. */
export function bandVar(band: BandName): string {
  return VAR[band];
}

export function starsForBand(band: BandName): 1 | 2 | 3 | 4 | 5 {
  return STARS[band];
}

/** The VHS band as a filled chip. Band colour here means score — product data. */
export function BandChip({ band }: { band: BandName }) {
  return (
    <span
      className="inline-block rounded-pill px-2.5 py-0.5 font-mono text-xs font-medium tracking-wide text-white"
      style={{ background: bandVar(band) }}
    >
      {LABEL[band]}
    </span>
  );
}
```

- [ ] **Step 4: Implement StarRating**

Create `apps/web/components/StarRating.tsx`:

```tsx
import { bandVar, starsForBand, type BandName } from "./BandChip";

/** The band's 1–5 rating. Filled stars carry the band colour; the rest are hairline. */
export function StarRating({ band, size = 14 }: { band: BandName; size?: number }) {
  const filled = starsForBand(band);
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={n <= filled ? bandVar(band) : "var(--ac-line)"}
          />
        </svg>
      ))}
    </span>
  );
}
```

- [ ] **Step 5: Implement CategoryBar**

Create `apps/web/components/CategoryBar.tsx`:

```tsx
import { bandVar, type BandName } from "./BandChip";

/** Same thresholds as the scoring engine's bandForScore. */
function bandForScore(score: number): BandName {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}

/** One inspection category's score as a labelled bar, filled in its band colour. */
export function CategoryBar({
  label, score, compact,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className={compact ? "text-ink text-xs" : "text-ink text-sm"}>{label}</span>
        <span className="font-mono text-xs text-ink-muted tabular-nums">{clamped}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-pill bg-line"
      >
        <div className="h-full" style={{ width: `${clamped}%`, background: bandVar(bandForScore(clamped)) }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/web && pnpm test -- BandChip StarRating CategoryBar`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/BandChip.tsx apps/web/components/StarRating.tsx apps/web/components/CategoryBar.tsx apps/web/components/BandChip.test.tsx apps/web/components/StarRating.test.tsx apps/web/components/CategoryBar.test.tsx
git commit -m "feat(web): add BandChip, StarRating and CategoryBar

The three score components the health-score rail needs; they existed only
in React Native. Band colours come from tokens via bandVar so no caller
inlines a protected hex."
```

---

### Task 5: Repair the work-order page

Three real defects: a local `StatusPill` shadows the real one and renders every lifecycle state the same navy; severity colours are hardcoded hexes; money renders in the body face so columns do not align.

**Files:**
- Modify: `apps/web/app/staff/work-orders/[id]/page.tsx`
- Test: `apps/web/app/staff/work-orders/work-order-presentation.test.tsx`

**Interfaces:**
- Consumes: `StatusPill`, `Plate` from `apps/web/components/`; `bandVar` from `components/BandChip` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/staff/work-orders/work-order-presentation.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "[id]", "page.tsx"), "utf8");

describe("work-order page presentation", () => {
  it("does not shadow the shared StatusPill with a local one", () => {
    expect(src).not.toMatch(/function StatusPill\s*\(/);
    expect(src).toMatch(/from "\.\.\/\.\.\/\.\.\/\.\.\/components\/StatusPill"/);
  });

  it("carries no hardcoded band hexes", () => {
    expect(src).not.toContain("#B3261E");
    expect(src).not.toContain("#C75E1B");
    expect(src).not.toContain("#B87E00");
  });

  it("renders money in the mono face with tabular figures", () => {
    expect(src).toContain("tabular-nums");
  });

  it("uses the Plate primitive for the plate", () => {
    expect(src).toMatch(/from "\.\.\/\.\.\/\.\.\/\.\.\/components\/Plate"/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- work-order-presentation`
Expected: FAIL on all four — the local `StatusPill`, the hexes, no tabular figures, no `Plate`.

- [ ] **Step 3: Delete the shadowing StatusPill and adopt the real one**

In `apps/web/app/staff/work-orders/[id]/page.tsx`:

Add the imports:

```tsx
import { StatusPill } from "../../../../components/StatusPill";
import { Plate } from "../../../../components/Plate";
import { bandVar } from "../../../../components/BandChip";
```

Delete the local `function StatusPill({ status }: { status: WorkOrderStatus })` entirely.

Add a tone map beside `STATUS_FLOW`, so lifecycle state carries colour meaning:

```tsx
/** Work-order lifecycle → pill tone: grey not started, blue moving, amber waiting
 *  on someone, green settled. */
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warn" | "danger"> = {
  DRAFT: "neutral",
  AWAITING_APPROVAL: "warn",
  APPROVED: "info",
  IN_PROGRESS: "info",
  QC: "info",
  READY: "info",
  CLOSED: "success",
  CANCELLED: "neutral",
};
```

Replace the header's `<StatusPill status={wo.status} />` with:

```tsx
            <StatusPill tone={STATUS_TONE[wo.status] ?? "neutral"}>{wo.status.replace("_", " ")}</StatusPill>
```

- [ ] **Step 4: Replace the hardcoded severity hexes with band tokens**

Delete:

```tsx
const SEVERITY_COLOR: Record<string, string> = { CRITICAL: "#B3261E", ATTENTION: "#C75E1B", MONITOR: "#B87E00" };
```

and replace with a mapping onto the band tokens:

```tsx
/** Finding severity → its protected band token. Severity is product data. */
const SEVERITY_VAR: Record<string, string> = {
  CRITICAL: bandVar("CRITICAL"),
  ATTENTION: bandVar("NEEDS_ATTENTION"),
  MONITOR: bandVar("FAIR"),
};
```

In `RecommendationsTray`, change the dot's style to
`style={{ backgroundColor: SEVERITY_VAR[r.severity] ?? "var(--ac-ink-muted)" }}`.

- [ ] **Step 5: Align the money columns and the plate**

In `ItemTable`, give every numeric cell the mono face and tabular figures. The qty, unit, discount and line cells become, respectively:

```tsx
              <td className="p-2 font-mono tabular-nums">{i.qty}</td>
              <td className="p-2 font-mono tabular-nums">{peso(i.unitPriceCentavos)}</td>
              <td className="p-2 font-mono tabular-nums">{i.discountCentavos ? `-${peso(i.discountCentavos)}` : "—"}</td>
              <td className="p-2 font-mono tabular-nums font-medium">{peso(i.lineTotalCentavos)}</td>
```

Give the table header row the display face:

```tsx
          <tr className="border-b border-line text-left font-display font-semibold tracking-[0.02em] text-ink">
```

In `TotalsPanel`'s `Row`, add `font-mono tabular-nums` to the value span so the totals column aligns with the table above it.

Replace the header's hand-rolled plate span with the primitive:

```tsx
            {wo.plateNo && <Plate variant="outline">{wo.plateNo}</Plate>}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/web && pnpm test -- work-order-presentation && pnpm typecheck`
Expected: PASS, 4 tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/staff/work-orders
git commit -m "fix(web): repair the work-order page's tokens and pill

A local StatusPill shadowed the shared one and rendered every lifecycle
state the same navy, so state carried no colour meaning. Severity dots
used hardcoded band hexes instead of tokens. Money rendered in the body
face, so amount columns did not align."
```

---

### Task 6: Health-score rail

**Files:**
- Create: `apps/web/lib/inspections/api.ts`
- Create: `apps/web/app/staff/work-orders/[id]/HealthScorePanel.tsx`
- Modify: `apps/web/app/staff/work-orders/[id]/page.tsx` (mount the panel in the aside)
- Test: `apps/web/app/staff/work-orders/HealthScorePanel.test.tsx`

**Interfaces:**
- Consumes: `GET /vehicles/:vehicleId/health-score` via the proxy; `Card`, `BandChip`, `StarRating`, `CategoryBar`, `EmptyState`.
- Produces:
  - `getHealthScore(vehicleId: string): Promise<VehicleHealthScore>`
  - `type VehicleHealthScore = { score: number; band: BandName; categoryScores: Array<{ categoryCode: string; label: string; score: number }> }`
  - `HealthScorePanel({ vehicleId }: { vehicleId: string | null })`

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/staff/work-orders/HealthScorePanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getHealthScore = vi.fn();
vi.mock("../../../lib/inspections/api", () => ({ getHealthScore: (...a: unknown[]) => getHealthScore(...a) }));

import { HealthScorePanel } from "./[id]/HealthScorePanel";

describe("HealthScorePanel", () => {
  beforeEach(() => getHealthScore.mockReset());

  it("shows the score, its band and each category", async () => {
    getHealthScore.mockResolvedValue({
      score: 69,
      band: "FAIR",
      categoryScores: [
        { categoryCode: "BRK", label: "Brakes", score: 55 },
        { categoryCode: "ENG", label: "Engine", score: 91 },
      ],
    });
    render(<HealthScorePanel vehicleId="v1" />);
    await waitFor(() => expect(screen.getByText("69")).toBeTruthy());
    expect(screen.getByText("Fair")).toBeTruthy();
    expect(screen.getByText("Brakes")).toBeTruthy();
    expect(screen.getByText("Engine")).toBeTruthy();
  });

  it("says so plainly when a vehicle has never been inspected", async () => {
    getHealthScore.mockRejectedValue(new Error("no health score yet for this vehicle"));
    render(<HealthScorePanel vehicleId="v1" />);
    await waitFor(() => expect(screen.getByText("No health score yet")).toBeTruthy());
  });

  it("renders nothing without a vehicle rather than fetching", () => {
    const { container } = render(<HealthScorePanel vehicleId={null} />);
    expect(container.firstChild).toBeNull();
    expect(getHealthScore).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- HealthScorePanel`
Expected: FAIL — neither the api module nor the panel resolves.

- [ ] **Step 3: Add the fetcher**

Create `apps/web/lib/inspections/api.ts`:

```ts
// Typed fetcher for the advisor's health-score rail. Goes through the BFF proxy,
// which attaches the httpOnly session cookie.
import type { BandName } from "../../components/BandChip";

export type VehicleHealthScore = {
  score: number;
  band: BandName;
  categoryScores: Array<{ categoryCode: string; label: string; score: number }>;
};

export async function getHealthScore(vehicleId: string): Promise<VehicleHealthScore> {
  const res = await fetch(`/api/proxy/vehicles/${vehicleId}/health-score`, {
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as VehicleHealthScore;
}
```

- [ ] **Step 4: Implement the panel**

Create `apps/web/app/staff/work-orders/[id]/HealthScorePanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../../components/Card";
import { BandChip } from "../../../../components/BandChip";
import { StarRating } from "../../../../components/StarRating";
import { CategoryBar } from "../../../../components/CategoryBar";
import { getHealthScore, type VehicleHealthScore } from "../../../../lib/inspections/api";

/** The advisor's score context for the vehicle in front of them. Degrades on its
 *  own — a vehicle with no inspection yet is a normal state, not an error. */
export function HealthScorePanel({ vehicleId }: { vehicleId: string | null }) {
  const [score, setScore] = useState<VehicleHealthScore | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    let live = true;
    getHealthScore(vehicleId)
      .then((s) => { if (live) setScore(s); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [vehicleId]);

  if (!vehicleId) return null;

  if (missing) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-ink">No health score yet</h2>
        <p className="mt-1 text-sm text-ink-muted">This vehicle has not been inspected.</p>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-ink">Health score</h2>
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded-sm bg-line" aria-busy="true" />
      </Card>
    );
  }

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Health score</h2>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[40px] leading-none font-semibold tabular-nums text-ink">
          {score.score}
        </span>
        <div>
          <BandChip band={score.band} />
          <div className="mt-1"><StarRating band={score.band} /></div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {score.categoryScores.map((c) => (
          <CategoryBar key={c.categoryCode} label={c.label} score={c.score} compact />
        ))}
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Mount it**

In `apps/web/app/staff/work-orders/[id]/page.tsx`, import the panel and put it at the top of the `<aside>`, above `TotalsPanel`:

```tsx
import { HealthScorePanel } from "./HealthScorePanel";
```

```tsx
          <aside className="flex flex-col gap-4">
            <HealthScorePanel vehicleId={wo.vehicleId ?? null} />
            <TotalsPanel totals={totals} />
```

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm test -- HealthScorePanel && pnpm typecheck`
Expected: PASS, 3 tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/inspections apps/web/app/staff/work-orders
git commit -m "feat(web): add the advisor health-score rail

The endpoint existed and nothing consumed it. A vehicle with no
inspection renders as a plain statement rather than an error."
```

---

### Task 7: Board "Today" aside

**Requires** `GET /scheduling/operating-hours` from Task 5 of the backend plan.

**Files:**
- Create: `apps/web/app/staff/schedule/TodayPanel.tsx`
- Modify: `apps/web/lib/scheduling/api.ts` (add `getOperatingHours`)
- Modify: `apps/web/app/staff/schedule/page.tsx` (two-column layout)
- Test: `apps/web/app/staff/schedule/TodayPanel.test.tsx`

**Interfaces:**
- Consumes: `BoardAppointment[]`, `getBays()`, and the new `getOperatingHours()`.
- Produces:
  - `getOperatingHours(): Promise<OperatingHours[]>` where `type OperatingHours = { weekday: string | null; dateOverride: string | null; openTime: string | null; closeTime: string | null; walkInBufferPct: number }`
  - `TodayPanel({ appointments }: { appointments: BoardAppointment[] })`

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/staff/schedule/TodayPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getBays = vi.fn();
const getOperatingHours = vi.fn();
vi.mock("../../../lib/scheduling/api", () => ({
  getBays: () => getBays(),
  getOperatingHours: () => getOperatingHours(),
}));

import { TodayPanel } from "./TodayPanel";

const appt = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "a1", bayId: "bay1", serviceTypeName: "Oil change",
  scheduledStart: "2026-08-28T01:00:00.000Z", scheduledEnd: "2026-08-28T02:00:00.000Z",
  status: "BOOKED", requiresPickup: false, vehiclePlateNo: "ABC 1234", memberName: "R. Tatel",
  ...over,
}) as never;

describe("TodayPanel", () => {
  beforeEach(() => {
    getBays.mockResolvedValue([{ id: "bay1" }, { id: "bay2" }, { id: "bay3" }]);
    getOperatingHours.mockResolvedValue([{ walkInBufferPct: 20 }]);
  });

  it("counts the day's bookings", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2" })]} />);
    await waitFor(() => expect(screen.getByText("Booked")).toBeTruthy());
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("counts bays in use against the total", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2", bayId: "bay2" })]} />);
    await waitFor(() => expect(screen.getByText("2 of 3")).toBeTruthy());
  });

  it("does not count a cancelled appointment as occupying a bay", async () => {
    render(<TodayPanel appointments={[appt(), appt({ id: "a2", bayId: "bay2", status: "CANCELLED" })]} />);
    await waitFor(() => expect(screen.getByText("1 of 3")).toBeTruthy());
  });

  it("counts pick-ups", async () => {
    render(<TodayPanel appointments={[appt({ requiresPickup: true }), appt({ id: "a2" })]} />);
    await waitFor(() => expect(screen.getByText("Pick-ups")).toBeTruthy());
    expect(screen.getByText("1")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- TodayPanel`
Expected: FAIL — cannot resolve `./TodayPanel`.

- [ ] **Step 3: Add the operating-hours fetcher**

Append to `apps/web/lib/scheduling/api.ts`:

```ts
export type OperatingHours = {
  weekday: string | null;
  dateOverride: string | null;
  openTime: string | null;
  closeTime: string | null;
  walkInBufferPct: number;
};
export const getOperatingHours = () => call<OperatingHours[]>("scheduling/operating-hours");
```

- [ ] **Step 4: Implement the panel**

Create `apps/web/app/staff/schedule/TodayPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/Card";
import { getBays, getOperatingHours, type BoardAppointment } from "../../../lib/scheduling/api";

/** A cancelled slot is not occupying a bay. */
const OCCUPIES = (status: string) => status !== "CANCELLED" && status !== "NO_SHOW";

/** The advisor's at-a-glance state of the day, beside the board. */
export function TodayPanel({ appointments }: { appointments: BoardAppointment[] }) {
  const [bayCount, setBayCount] = useState<number | null>(null);
  const [bufferPct, setBufferPct] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getBays().then((b) => { if (live) setBayCount(b.length); }).catch(() => undefined);
    getOperatingHours()
      .then((h) => { if (live && h.length > 0) setBufferPct(h[0].walkInBufferPct); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);

  const booked = appointments.length;
  const baysInUse = new Set(
    appointments.filter((a) => OCCUPIES(a.status) && a.bayId).map((a) => a.bayId),
  ).size;
  const pickups = appointments.filter((a) => a.requiresPickup && OCCUPIES(a.status)).length;

  const rows: Array<[string, string]> = [
    ["Booked", String(booked)],
    ["Bays in use", bayCount === null ? "—" : `${baysInUse} of ${bayCount}`],
    ["Walk-in buffer", bufferPct === null ? "—" : `${bufferPct}%`],
    ["Pick-ups", String(pickups)],
  ];

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Today</h2>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-t border-line py-1.5 text-sm">
          <span className="text-ink-muted">{label}</span>
          <span className="font-mono tabular-nums text-ink">{value}</span>
        </div>
      ))}
    </Card>
  );
}
```

- [ ] **Step 5: Put the board in two columns**

In `apps/web/app/staff/schedule/page.tsx`, import the panel and wrap the board area. Replace the single-column container with:

```tsx
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_300px]">
          <section className="flex flex-col gap-5">
            {error && <p className="text-danger text-sm">{error}</p>}
            {loading ? <p className="text-ink-muted text-sm py-8 text-center">Loading…</p> : <Board appointments={appts} onCancel={onCancel} />}
          </section>
          <TodayPanel appointments={appts} />
        </div>
```

keeping the existing header and date controls above it.

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm test -- TodayPanel && pnpm typecheck`
Expected: PASS, 4 tests; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/staff/schedule apps/web/lib/scheduling/api.ts
git commit -m "feat(web): add the board's Today panel

Booked and pick-ups derive from the board; bays-in-use counts distinct
occupied bays, ignoring cancelled and no-show slots; the walk-in buffer
comes from the new operating-hours read."
```

---

### Task 8: Admin KPI row, checklist weights and waste export

**Requires** `GET /admin/analytics/summary` and `GET /admin/waste/summary` from the backend plan.

**Files:**
- Create: `apps/web/lib/analytics/api.ts`
- Create: `apps/web/app/admin/KpiRow.tsx`
- Create: `apps/web/app/admin/WastePanel.tsx`
- Create: `apps/web/app/admin/ChecklistWeightsCard.tsx`
- Modify: `apps/web/app/admin/page.tsx`
- Modify: `apps/web/app/admin/UtilisationWidget.tsx` (heading + caption)
- Test: `apps/web/app/admin/KpiRow.test.tsx`, `apps/web/app/admin/WastePanel.test.tsx`

**Interfaces:**
- Consumes: `Card`, `EmptyState`, `Button`.
- Produces:
  - `getAnalyticsSummary(): Promise<AnalyticsSummary>` where `type AnalyticsSummary = { mrrCentavos: string; activeMembers: number; churn30d: number; bayUtilisation: number }`
  - `getWasteSummary(from: string, to: string): Promise<WasteSummary>` where `type WasteSummary = { totals: Array<{ wasteType: string; quantity: number; unit: string }>; recordCount: number; lastExportedAt: string | null }`
  - `KpiRow()`, `WastePanel()`, `ChecklistWeightsCard()`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/admin/KpiRow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getAnalyticsSummary = vi.fn();
vi.mock("../../lib/analytics/api", () => ({
  getAnalyticsSummary: () => getAnalyticsSummary(),
  getWasteSummary: vi.fn(),
}));

import { KpiRow } from "./KpiRow";

describe("KpiRow", () => {
  beforeEach(() => getAnalyticsSummary.mockReset());

  it("renders MRR as pesos, not centavos", async () => {
    getAnalyticsSummary.mockResolvedValue({ mrrCentavos: "41230000", activeMembers: 274, churn30d: 0.021, bayUtilisation: 0.78 });
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("₱412,300")).toBeTruthy());
  });

  it("renders churn and utilisation as percentages", async () => {
    getAnalyticsSummary.mockResolvedValue({ mrrCentavos: "0", activeMembers: 0, churn30d: 0.021, bayUtilisation: 0.78 });
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("2.1%")).toBeTruthy());
    expect(screen.getByText("78%")).toBeTruthy();
  });

  it("degrades to a retryable message without blanking the dashboard", async () => {
    getAnalyticsSummary.mockRejectedValue(new Error("offline"));
    render(<KpiRow />);
    await waitFor(() => expect(screen.getByText("Could not load the numbers")).toBeTruthy());
  });
});
```

Create `apps/web/app/admin/WastePanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getWasteSummary = vi.fn();
vi.mock("../../lib/analytics/api", () => ({
  getWasteSummary: (...a: unknown[]) => getWasteSummary(...a),
  getAnalyticsSummary: vi.fn(),
}));

import { WastePanel } from "./WastePanel";

describe("WastePanel", () => {
  beforeEach(() => getWasteSummary.mockReset());

  it("summarises the quarter's records by type", async () => {
    getWasteSummary.mockResolvedValue({
      recordCount: 42,
      totals: [{ wasteType: "USED_OIL", quantity: 168, unit: "L" }, { wasteType: "FILTER", quantity: 61, unit: "pcs" }],
      lastExportedAt: "2026-06-30T00:00:00.000Z",
    });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/42 records/)).toBeTruthy());
    expect(screen.getByText(/used oil 168 L/i)).toBeTruthy();
  });

  it("says when it was last exported", async () => {
    getWasteSummary.mockResolvedValue({ recordCount: 0, totals: [], lastExportedAt: "2026-06-30T00:00:00.000Z" });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/Last export/)).toBeTruthy());
  });

  it("says so when nothing has ever been exported", async () => {
    getWasteSummary.mockResolvedValue({ recordCount: 0, totals: [], lastExportedAt: null });
    render(<WastePanel />);
    await waitFor(() => expect(screen.getByText(/Never exported/)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/web && pnpm test -- KpiRow WastePanel`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Add the fetchers**

Create `apps/web/lib/analytics/api.ts`:

```ts
// Admin dashboard fetchers. Through the BFF proxy, which attaches the session cookie.

export type AnalyticsSummary = {
  /** Decimal string — centavos exceed JSON's safe integer range as a bigint server-side. */
  mrrCentavos: string;
  activeMembers: number;
  churn30d: number;
  bayUtilisation: number;
};

export type WasteSummary = {
  totals: Array<{ wasteType: string; quantity: number; unit: string }>;
  recordCount: number;
  lastExportedAt: string | null;
};

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new Error(body?.error?.message ?? `request failed (${res.status})`);
  }
  return body.data as T;
}

export const getAnalyticsSummary = () => call<AnalyticsSummary>("admin/analytics/summary");
export const getWasteSummary = (from: string, to: string) =>
  call<WasteSummary>(`admin/waste/summary?from=${from}&to=${to}`);
```

- [ ] **Step 4: Implement KpiRow**

Create `apps/web/app/admin/KpiRow.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "../../components/Card";
import { getAnalyticsSummary, type AnalyticsSummary } from "../../lib/analytics/api";

const pesos = (centavos: string) =>
  `₱${Math.round(Number(centavos) / 100).toLocaleString("en-PH")}`;
const pct = (ratio: number, dp = 0) => `${(ratio * 100).toFixed(dp)}%`;

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card pad="lg">
      <div className="font-body text-xs uppercase tracking-[0.03em] text-ink-muted">{label}</div>
      <div className="font-display text-[34px] font-semibold leading-tight tabular-nums text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{note}</div>
    </Card>
  );
}

/** The four numbers an owner opens the console for. Fails on its own — a dead
 *  analytics call must not blank the rest of the dashboard. */
export function KpiRow() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getAnalyticsSummary()
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-danger">Could not load the numbers</h2>
        <p className="mt-1 text-sm text-ink-muted">The analytics service did not respond. Reload to try again.</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Card key={n} pad="lg">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-line" aria-busy="true" />
            <div className="mt-2 h-8 w-1/2 animate-pulse rounded-sm bg-line" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="MRR" value={pesos(data.mrrCentavos)} note="active, grace and past-due plans" />
      <Kpi label="Active members" value={data.activeMembers.toLocaleString("en-PH")} note="distinct members under contract" />
      <Kpi label="Churn (30d)" value={pct(data.churn30d, 1)} note="cancelled in the last 30 days" />
      <Kpi label="Bay utilisation" value={pct(data.bayUtilisation)} note="mean, next 14 days" />
    </div>
  );
}
```

- [ ] **Step 5: Implement WastePanel**

Create `apps/web/app/admin/WastePanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { getWasteSummary, type WasteSummary } from "../../lib/analytics/api";

/** Calendar quarter to date — the window DENR reporting is filed on. */
function quarterToDate(): { from: string; to: string } {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3);
  const from = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

const prettyType = (t: string) => t.replace("_", " ").toLowerCase();

/** W-09 DENR reporting. The export is a regulator-facing document, so the card
 *  states plainly when it was last produced. */
export function WastePanel() {
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const { from, to } = quarterToDate();

  useEffect(() => {
    let live = true;
    getWasteSummary(from, to)
      .then((s) => { if (live) setSummary(s); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [from, to]);

  if (failed) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-danger">Could not load waste records</h2>
      </Card>
    );
  }

  const totals = summary?.totals.map((t) => `${prettyType(t.wasteType)} ${t.quantity} ${t.unit}`).join(", ");

  return (
    <Card pad="lg">
      <h2 className="mb-1 font-display text-lg text-ink">Waste log export (DENR)</h2>
      <div className="flex items-center gap-4">
        <p className="flex-1 text-sm text-ink-muted">
          {summary === null
            ? "Loading this quarter's records…"
            : `${summary.recordCount} records this quarter${totals ? ` · ${totals}` : ""}. ` +
              (summary.lastExportedAt
                ? `Last export ${new Date(summary.lastExportedAt).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })}.`
                : "Never exported.")}
        </p>
        <a href={`/api/proxy/admin/waste/export?from=${from}&to=${to}`} download>
          <Button variant="secondary">Export CSV</Button>
        </a>
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: Implement ChecklistWeightsCard**

Create `apps/web/app/admin/ChecklistWeightsCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { getActiveChecklist, type EditorCategory } from "../../lib/checklists/api";

/** The active checklist's category weights at a glance, with a way into the editor. */
export function ChecklistWeightsCard() {
  const [categories, setCategories] = useState<EditorCategory[] | null>(null);

  useEffect(() => {
    let live = true;
    getActiveChecklist()
      .then((c) => { if (live) setCategories(c.categories); })
      .catch(() => { if (live) setCategories([]); });
    return () => { live = false; };
  }, []);

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Checklist editor</h2>
      <div className="flex flex-col">
        {(categories ?? []).map((c) => (
          <div key={c.code} className="flex items-center justify-between border-t border-line py-2 text-sm">
            <span className="text-ink">{c.label}</span>
            <span className="inline-flex gap-3 font-mono text-xs tabular-nums text-ink-muted">
              <span>{c.weight}%</span>
              <span>{c.points.length} points</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Weights are versioned — editing creates a new checklist version.
      </p>
      <Link href="/admin/checklists" className="mt-2 block">
        <Button variant="secondary" block>Edit weights</Button>
      </Link>
    </Card>
  );
}
```

- [ ] **Step 7: Compose the dashboard**

Rewrite the body of `apps/web/app/admin/page.tsx` so it renders the mockup's layout. It keeps its existing utilisation fetch and drops the header chrome the shell now provides:

```tsx
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Admin dashboard</h1>
        {err && <p className="text-danger text-sm">{err}</p>}

        <KpiRow />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          <UtilisationWidget days={util} />
          <ChecklistWeightsCard />
        </div>

        <WastePanel />
      </div>
```

Add the three imports at the top of the file.

- [ ] **Step 8: Finish the utilisation widget**

In `apps/web/app/admin/UtilisationWidget.tsx`, change the heading to `Forward utilisation · next 14 days` and add the mockup's caption directly under the chart, inside the `<section>`:

```tsx
      <p className="mt-2 text-xs text-ink-muted">
        Dashed line is the 85% capacity threshold. Bars turn amber approaching it and red once breached.
      </p>
```

- [ ] **Step 9: Verify**

Run: `cd apps/web && pnpm test && pnpm typecheck`
Expected: PASS — 6 new tests plus every existing suite; typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/admin apps/web/lib/analytics
git commit -m "feat(web): build the admin dashboard panels

KPI row, checklist-weights summary and the DENR waste export card, each
fetching independently so one dead call never blanks the dashboard. The
utilisation widget gains the heading and caption it was missing."
```

---

### Task 9: Adopt the primitives on the remaining pages

**Files:**
- Modify: `apps/web/app/staff/page.tsx`
- Modify: `apps/web/app/staff/config/page.tsx`
- Modify: `apps/web/app/admin/checklists/page.tsx`
- Modify: `apps/web/app/staff/schedule/Board.tsx` (adopt `Plate`)
- Test: `apps/web/app/staff/primitive-adoption.test.tsx`

**Interfaces:**
- Consumes: `Button`, `FormField`, `EmptyState`, `Plate`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/staff/primitive-adoption.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf8");

describe("the component library is actually used", () => {
  it("the board renders plates through the Plate primitive", () => {
    expect(read("schedule", "Board.tsx")).toMatch(/from "\.\.\/\.\.\/\.\.\/components\/Plate"/);
  });

  it("the staff index uses Button rather than hand-rolled anchors", () => {
    expect(read("page.tsx")).toMatch(/from "\.\.\/\.\.\/components\/Button"/);
  });

  it("capacity settings uses the shared form primitives", () => {
    const src = read("config", "page.tsx");
    expect(src).toMatch(/components\/(Button|FormField)/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && pnpm test -- primitive-adoption`
Expected: FAIL on all three.

- [ ] **Step 3: Adopt Plate on the board**

In `apps/web/app/staff/schedule/Board.tsx`, import `Plate` and replace the hand-rolled plate span:

```tsx
import { Plate } from "../../../components/Plate";
```

```tsx
                    <Plate variant="plain" className="text-sm font-semibold">{a.vehiclePlateNo}</Plate>
```

Leave `STATUS_TONE` exactly as it is — the richer mapping is a deliberate deviation from the mockup, recorded in the spec.

- [ ] **Step 4: Adopt Button on the staff index**

In `apps/web/app/staff/page.tsx`, wrap each `Link` in a `Button` rather than styling the anchor by hand:

```tsx
import { Button } from "../../components/Button";
```

```tsx
      <nav className="flex gap-3">
        <Link href="/staff/schedule"><Button>Schedule board</Button></Link>
        <Link href="/staff/config"><Button variant="secondary">Capacity settings</Button></Link>
      </nav>
```

- [ ] **Step 5: Adopt the primitives on config and checklists**

In `apps/web/app/staff/config/page.tsx` and `apps/web/app/admin/checklists/page.tsx`, replace hand-rolled `<button className="h-9 px-3 rounded-sm bg-primary text-white …">` elements with `<Button>` (keeping each button's existing `onClick`, `disabled` and label), and replace bare `<input>` + `<label>` pairs with `FormField` where the field has a visible label. Where a list renders nothing, use `EmptyState` instead of a bare paragraph.

Keep every existing handler and piece of copy — this step changes presentation only.

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm test && pnpm typecheck`
Expected: PASS — including the existing Board tests, which must not regress.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app
git commit -m "feat(web): adopt the component library across the console

Button, FormField and EmptyState had zero importers despite shipping in
the 2026-08-25 pass. The board's plate moves onto the Plate primitive;
its status tone map stays richer than the mockup on purpose."
```

---

### Task 10: Verify and record the pass

**Files:**
- Create: `docs/checkpoints/2026-08-28-staff-web-console-fidelity.md`

- [ ] **Step 1: Run the web suite and typecheck**

Run: `cd apps/web && pnpm test 2>&1 | tail -20 && pnpm typecheck`
Expected: all suites pass; typecheck clean.

- [ ] **Step 2: Run lint**

Run: `cd apps/web && pnpm lint 2>&1 | tail -20`
Expected: clean. Fix anything it reports.

- [ ] **Step 3: Confirm the library is genuinely adopted**

Run:

```bash
cd apps/web && for c in Button Card StatusPill EmptyState FormField Plate BandChip StarRating CategoryBar TopBar; do
  printf "%-14s %s\n" "$c" "$(grep -rl "components/$c\"" app components --include='*.tsx' | grep -v ".test." | wc -l | tr -d ' ')"
done
```

Expected: every component has at least one non-test importer. `Button`, `FormField` and `EmptyState` were 0 before this pass.

- [ ] **Step 4: Confirm no raw band hexes survive**

Run: `cd apps/web && grep -rnE '#(B3261E|C75E1B|B87E00|177245|5C9E31)' app components --include='*.tsx' || echo "no raw band hexes"`
Expected: `no raw band hexes`.

- [ ] **Step 5: Write the checkpoint**

Create `docs/checkpoints/2026-08-28-staff-web-console-fidelity.md` recording: the backend added (cancelledAt migration and its approximate backfill, analytics endpoint with its metric definitions, waste export and its audit trail, operating-hours read); the chrome and primitives delivered; the work-order defects repaired; the four flagged deviations (board tone map, no entitlements card, no roadside card, approximate churn history); and what remains owed — a live-API smoke test of the new panels, and Playwright e2e which stays deferred.

- [ ] **Step 6: Commit**

```bash
git add docs/checkpoints/2026-08-28-staff-web-console-fidelity.md
git commit -m "docs: checkpoint the staff web console fidelity pass"
```

---

## Self-Review

**Spec coverage:** §2.1 → Tasks 1–2; §2.2 → Tasks 3 and 9; §2.3 → Tasks 5–6 (repairs, then the rail that needs Task 4's components); §2.4 → Task 8; §2.5 → Task 7; the error-handling section → the independent-fetch pattern in Tasks 6, 7 and 8, each with a failure test; the testing section's web bullet → the test step opening every task plus Task 10.

**Type consistency:** `BandName` is defined in Task 4's `BandChip.tsx` and consumed by `StarRating`, `CategoryBar` and Task 6's `VehicleHealthScore`. `bandVar` is defined once in Task 4 and used in Task 5's `SEVERITY_VAR`. `AnalyticsSummary` and `WasteSummary` in Task 8's `lib/analytics/api.ts` mirror the backend plan's Task 3 and Task 4 response shapes exactly, including `mrrCentavos` as a **string**. `OperatingHours` in Task 7 mirrors the backend plan's Task 5 response.

**Cross-plan dependency:** Tasks 7 and 8 fail until the backend plan's Tasks 3, 4 and 5 are merged. Tasks 1–6 and 9 are independent of it. The header states this.
