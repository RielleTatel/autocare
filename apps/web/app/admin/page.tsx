"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UtilisationWidget } from "./UtilisationWidget";
import { getUtilisation, type DayUtilisation } from "../../lib/scheduling/api";

export default function AdminPage() {
  const [util, setUtil] = useState<DayUtilisation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getUtilisation(14)
      .then(setUtil)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load utilisation"));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Admin dashboard</h1>
        <Link href="/admin/checklists" className="text-primary text-sm font-medium">Checklists</Link>
      </header>
      {err && <p className="text-danger text-sm">{err}</p>}
      <UtilisationWidget days={util} />
    </div>
  );
}
