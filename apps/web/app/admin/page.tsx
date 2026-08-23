"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtilisationWidget } from "./UtilisationWidget";
import { getUtilisation, type DayUtilisation } from "../../lib/scheduling/api";

export default function AdminPage() {
  const router = useRouter();
  const [util, setUtil] = useState<DayUtilisation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getUtilisation(14)
      .then(setUtil)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load utilisation"));
  }, []);

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-chassis px-6 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Admin dashboard</h1>
          <button type="button" onClick={signOut} className="h-9 px-3 rounded-sm border border-line text-ink text-sm font-medium">
            Sign out
          </button>
        </header>
        {err && <p className="text-danger text-sm">{err}</p>}
        <UtilisationWidget days={util} />
      </div>
    </main>
  );
}
