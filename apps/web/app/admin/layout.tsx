import type { ReactNode } from "react";
import { StaffShell } from "../../components/StaffShell";
import { cookies } from "next/headers";
import { openSession } from "../../lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookie = cookies().get("ac_session")?.value;
  const session = cookie ? await openSession(cookie) : null;
  return <StaffShell consoleLabel="admin console" active="Admin" role={session?.role}>{children}</StaffShell>;
}
