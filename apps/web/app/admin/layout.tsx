import type { ReactNode } from "react";
import { StaffShell } from "../../components/StaffShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StaffShell consoleLabel="admin console" active="Admin">{children}</StaffShell>;
}
