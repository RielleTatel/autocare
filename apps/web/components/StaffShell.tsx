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
