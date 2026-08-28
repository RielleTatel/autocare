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
