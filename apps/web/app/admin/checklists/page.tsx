"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createDraft, listChecklists, type ChecklistVersionSummary } from "../../../lib/checklists/api";

export default function ChecklistsPage() {
  const [versions, setVersions] = useState<ChecklistVersionSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => listChecklists().then(setVersions).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  useEffect(() => {
    refresh();
  }, []);

  async function onCreateDraft() {
    setBusy(true);
    setErr(null);
    try {
      await createDraft();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create draft");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-chassis px-6 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Inspection checklists</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-primary text-sm font-medium">← Admin</Link>
            <button type="button" disabled={busy} onClick={onCreateDraft} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
              New draft from active
            </button>
          </div>
        </header>
        {err && <p className="text-danger text-sm">{err}</p>}
        <section className="rounded-md border border-line bg-surface divide-y divide-line">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-ink text-sm">{v.versionLabel}</span>
                <span className="font-mono text-ink-muted text-xs">{v.weightVersion}</span>
                {v.isActive && <span className="rounded-pill bg-success text-white text-xs px-2 py-0.5">Active</span>}
                {v.status === "DRAFT" && <span className="rounded-pill border border-line text-ink-muted text-xs px-2 py-0.5">Draft</span>}
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/admin/checklists/${v.id}`} className="text-primary font-medium">
                  {v.status === "DRAFT" ? "Edit" : "View"}
                </Link>
                <Link href={`/admin/checklists/${v.id}/weights`} className="text-primary font-medium">Weights</Link>
              </div>
            </div>
          ))}
          {versions.length === 0 && <p className="px-4 py-3 text-ink-muted text-sm">No versions yet</p>}
        </section>
      </div>
    </main>
  );
}
