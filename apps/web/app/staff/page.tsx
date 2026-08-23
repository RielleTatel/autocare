"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StaffPage() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-chassis px-4 gap-4">
      <p className="text-ink text-lg">Advisor console</p>
      <nav className="flex gap-3">
        <Link href="/staff/schedule" className="h-10 px-4 flex items-center rounded-sm bg-primary text-white text-sm font-medium">
          Schedule board
        </Link>
        <Link href="/staff/config" className="h-10 px-4 flex items-center rounded-sm border border-line text-ink text-sm font-medium">
          Capacity settings
        </Link>
      </nav>
      <button
        type="button"
        onClick={signOut}
        className="h-10 px-4 rounded-sm border border-line text-ink text-sm font-medium"
      >
        Sign out
      </button>
    </main>
  );
}
