"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";

const StaffRoleContext = createContext<string | undefined>(undefined);
export const useStaffRole = () => useContext(StaffRoleContext);

/**
 * Page frame for every signed-in staff surface. Sign-out lives here rather than
 * on individual pages, where it was previously duplicated twice and missing twice.
 */
export function StaffShell({
  consoleLabel, active, children, role,
}: {
  consoleLabel: string;
  active?: string;
  children: ReactNode;
  role?: string;
}) {
  const router = useRouter();
  const nav = [
    { label: "Schedule", href: "/staff/schedule" },
    { label: "Capacity", href: "/staff/config" },
    ...(role === "ADMIN" || role === "ADVISOR" ? [{ label: "Cash bills", href: "/staff/billing" }] : []),
    ...(!role || role === "ADMIN" ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <StaffRoleContext.Provider value={role}><div className="flex min-h-screen flex-col bg-chassis">
      <TopBar consoleLabel={consoleLabel} nav={nav} active={active} onSignOut={signOut} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
    </div></StaffRoleContext.Provider>
  );
}
