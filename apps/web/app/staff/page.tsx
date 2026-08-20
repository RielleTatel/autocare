"use client";

import { useRouter } from "next/navigation";

export default function StaffPage() {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-chassis px-4 gap-4">
      <p className="text-ink text-lg">Advisor console — Phase 3 fills this in</p>
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
