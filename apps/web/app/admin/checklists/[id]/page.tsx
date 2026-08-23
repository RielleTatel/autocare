"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getChecklist, patchDraft, publishChecklist, type ChecklistVersionFull, type EditorCategory, type EditorPoint } from "../../../../lib/checklists/api";

/** A-04 — checklist editor. Drafts are editable; published versions render read-only. */
export default function ChecklistEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [version, setVersion] = useState<ChecklistVersionFull | null>(null);
  const [categories, setCategories] = useState<EditorCategory[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    getChecklist(id)
      .then((v) => {
        setVersion(v);
        setCategories(v.categories);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  const editable = version?.status === "DRAFT";
  const weightSum = categories.reduce((s, c) => s + c.weight, 0);

  const setPoint = (ci: number, pi: number, patch: Partial<EditorPoint>) => {
    setCategories((cats) => cats.map((c, i) => (i === ci ? { ...c, points: c.points.map((p, j) => (j === pi ? { ...p, ...patch } : p)) } : c)));
  };
  const moveCategory = (ci: number, dir: -1 | 1) => {
    setCategories((cats) => {
      const next = [...cats];
      const to = ci + dir;
      if (to < 0 || to >= next.length) return cats;
      [next[ci], next[to]] = [next[to], next[ci]];
      return next;
    });
  };

  async function save() {
    setErr(null);
    setMsg(null);
    try {
      const v = await patchDraft(id, categories);
      setVersion(v);
      setCategories(v.categories);
      setMsg("Draft saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function publish() {
    setErr(null);
    try {
      await save();
      await publishChecklist(id);
      router.push("/admin/checklists");
    } catch (e) {
      setPublishOpen(false);
      setErr(e instanceof Error ? e.message : "Publish failed");
    }
  }

  if (!version) {
    return <main className="min-h-screen bg-chassis px-6 py-6"><p className="text-ink-muted text-sm">{err ?? "Loading…"}</p></main>;
  }

  return (
    <main className="min-h-screen bg-chassis px-6 py-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">
            Checklist <span className="font-mono">{version.versionLabel}</span>
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/checklists" className="text-primary text-sm font-medium">← Versions</Link>
            {editable && (
              <>
                <button type="button" onClick={save} className="h-9 px-3 rounded-sm border border-line text-ink text-sm font-medium">Save draft</button>
                <button type="button" onClick={() => setPublishOpen(true)} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium">Publish…</button>
              </>
            )}
          </div>
        </header>

        {!editable && (
          <p className="rounded-sm border border-line bg-surface px-3 py-2 text-ink-muted text-sm">
            This version is published and immutable. Create a new draft from the versions page to make changes.
          </p>
        )}
        {editable && (
          <p className="rounded-sm border border-primary bg-surface px-3 py-2 text-primary text-sm">
            Draft — changes here affect no existing scores until published.
          </p>
        )}
        {msg && <p className="text-success text-sm">{msg}</p>}
        {err && <p className="text-danger text-sm">{err}</p>}
        <p className={`text-sm font-medium ${Math.abs(weightSum - 100) < 1e-9 ? "text-success" : "text-danger"}`}>
          Category weights sum: {weightSum} / 100
        </p>

        {categories.map((cat, ci) => (
          <section key={cat.code} className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">
                {cat.label} <span className="text-ink-muted text-sm">({cat.code}, weight {cat.weight})</span>
              </h2>
              {editable && (
                <div className="flex gap-1">
                  <button type="button" aria-label={`Move ${cat.code} up`} onClick={() => moveCategory(ci, -1)} className="h-8 w-8 rounded-sm border border-line text-ink">↑</button>
                  <button type="button" aria-label={`Move ${cat.code} down`} onClick={() => moveCategory(ci, 1)} className="h-8 w-8 rounded-sm border border-line text-ink">↓</button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-ink">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-1 pr-2">Point</th>
                    <th className="py-1 pr-2">Label (EN / FIL)</th>
                    <th className="py-1 pr-2">Weight</th>
                    <th className="py-1 pr-2">Safety</th>
                    <th className="py-1 pr-2">Type</th>
                    <th className="py-1 pr-2">Thresholds</th>
                    <th className="py-1 pr-2">Photo on adverse</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.points.map((p, pi) => (
                    <tr key={p.code} className="border-t border-line align-top">
                      <td className="py-1 pr-2 font-mono text-xs">{p.code}</td>
                      <td className="py-1 pr-2">
                        {editable ? (
                          <div className="flex flex-col gap-1">
                            <input aria-label={`${p.code} label`} value={p.label} onChange={(e) => setPoint(ci, pi, { label: e.target.value })} className="h-8 px-2 rounded-sm border border-line bg-chassis" />
                            <input aria-label={`${p.code} label (Filipino)`} value={p.labelFil ?? ""} onChange={(e) => setPoint(ci, pi, { labelFil: e.target.value })} className="h-8 px-2 rounded-sm border border-line bg-chassis" />
                          </div>
                        ) : (
                          <span>{p.label} <span className="text-ink-muted">/ {p.labelFil}</span></span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        {editable ? (
                          <input aria-label={`${p.code} weight`} type="number" value={p.weightInCategory} onChange={(e) => setPoint(ci, pi, { weightInCategory: Number(e.target.value) })} className="h-8 w-16 px-2 rounded-sm border border-line bg-chassis" />
                        ) : p.weightInCategory}
                      </td>
                      <td className="py-1 pr-2">
                        <input aria-label={`${p.code} safety-critical`} type="checkbox" disabled={!editable} checked={p.isSafetyCritical} onChange={(e) => setPoint(ci, pi, { isSafetyCritical: e.target.checked })} />
                      </td>
                      <td className="py-1 pr-2">{p.inputType === "MEASURED" ? `Measured (${p.unit ?? "?"})` : "Status"}</td>
                      <td className="py-1 pr-2 font-mono text-xs">
                        {p.thresholds ? `${p.thresholds.direction === "HIGHER_BETTER" ? "≥" : "<"} ${p.thresholds.good} / ${p.thresholds.monitor} / ${p.thresholds.attention}` : "—"}
                      </td>
                      <td className="py-1 pr-2">
                        <input aria-label={`${p.code} photo on adverse`} type="checkbox" disabled={!editable} checked={p.requiresPhotoOnAdverse ?? false} onChange={(e) => setPoint(ci, pi, { requiresPhotoOnAdverse: e.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {publishOpen && (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-md bg-surface border border-line p-6 flex flex-col gap-4">
              <h2 className="font-display text-xl text-ink">Publish {version.versionLabel}?</h2>
              <p className="text-ink text-sm">
                Existing scores are unaffected; new inspections will use {version.versionLabel}. Publishing validates
                weights (must sum to 100), thresholds on measured points, and EN+FIL labels — problems will be reported here.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPublishOpen(false)} className="h-9 px-3 rounded-sm border border-line text-ink text-sm font-medium">Cancel</button>
                <button type="button" onClick={publish} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium">Publish</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
