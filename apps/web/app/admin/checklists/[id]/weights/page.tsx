"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getActiveChecklist, getChecklist, patchDraft, previewScore,
  type ChecklistVersionFull, type EditorCategory, type PreviewResult,
} from "../../../../../lib/checklists/api";

/** A-05 — weight editor: category sliders with a live sum gate, per-point weights,
 *  side-by-side diff vs the current active version, and a preview-score panel. */
export default function WeightEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [version, setVersion] = useState<ChecklistVersionFull | null>(null);
  const [active, setActive] = useState<ChecklistVersionFull | null>(null);
  const [categories, setCategories] = useState<EditorCategory[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resultsJson, setResultsJson] = useState('[\n  { "pointCode": "ENGINE_IDLE", "status": "GOOD" }\n]');
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  useEffect(() => {
    Promise.all([getChecklist(id), getActiveChecklist().catch(() => null)])
      .then(([v, a]) => {
        setVersion(v);
        setCategories(v.categories);
        setActive(a);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  const editable = version?.status === "DRAFT";
  const sum = useMemo(() => categories.reduce((s, c) => s + c.weight, 0), [categories]);
  const sumOk = Math.abs(sum - 100) < 1e-9;
  const activeWeight = (code: string) => active?.categories.find((c) => c.code === code)?.weight;

  const setWeight = (ci: number, weight: number) =>
    setCategories((cats) => cats.map((c, i) => (i === ci ? { ...c, weight } : c)));
  const setPointWeight = (ci: number, pi: number, w: number) =>
    setCategories((cats) => cats.map((c, i) => (i === ci ? { ...c, points: c.points.map((p, j) => (j === pi ? { ...p, weightInCategory: w } : p)) } : c)));

  async function save() {
    if (!sumOk) {
      setErr("Category weights must sum to 100 before saving");
      return;
    }
    setErr(null);
    try {
      const v = await patchDraft(id, categories);
      setVersion(v);
      setCategories(v.categories);
      setMsg("Weights saved to draft");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function runPreview() {
    setErr(null);
    setPreview(null);
    try {
      const results = JSON.parse(resultsJson);
      // preview runs against the saved draft — save first so sliders count
      if (editable) await save();
      setPreview(await previewScore(id, results));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview failed");
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
            Weights — <span className="font-mono">{version.versionLabel}</span>
          </h1>
          <div className="flex items-center gap-3">
            <Link href={`/admin/checklists/${id}`} className="text-primary text-sm font-medium">← Editor</Link>
            {editable && (
              <button type="button" onClick={save} disabled={!sumOk} className="h-9 px-3 rounded-sm bg-primary text-white text-sm font-medium disabled:opacity-50">
                Save weights
              </button>
            )}
          </div>
        </header>
        {msg && <p className="text-success text-sm">{msg}</p>}
        {err && <p className="text-danger text-sm">{err}</p>}

        <p className={`text-sm font-semibold ${sumOk ? "text-success" : "text-danger"}`} data-testid="weight-sum">
          Total: {sum} / 100 {sumOk ? "✓" : "— must equal 100"}
        </p>

        {categories.map((cat, ci) => (
          <section key={cat.code} className="rounded-md border border-line bg-surface p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="font-display text-ink w-56">{cat.label}</span>
              <input
                aria-label={`${cat.code} category weight`}
                type="range" min={0} max={40} step={1} value={cat.weight} disabled={!editable}
                onChange={(e) => setWeight(ci, Number(e.target.value))}
                className="flex-1"
              />
              <span className="font-mono text-ink text-sm w-10 text-right">{cat.weight}</span>
              {activeWeight(cat.code) !== undefined && activeWeight(cat.code) !== cat.weight && (
                <span className="text-xs text-ink-muted">active: {activeWeight(cat.code)}</span>
              )}
            </div>
            <details>
              <summary className="text-ink-muted text-sm cursor-pointer">Point weights</summary>
              <div className="flex flex-col gap-1 pt-2">
                {cat.points.map((p, pi) => (
                  <div key={p.code} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs w-52 text-ink-muted">{p.code}</span>
                    <input
                      aria-label={`${p.code} point weight`}
                      type="number" value={p.weightInCategory} disabled={!editable}
                      onChange={(e) => setPointWeight(ci, pi, Number(e.target.value))}
                      className="h-8 w-20 px-2 rounded-sm border border-line bg-chassis text-ink"
                    />
                  </div>
                ))}
              </div>
            </details>
          </section>
        ))}

        <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
          <h2 className="font-display text-lg text-ink">Preview a score under these weights</h2>
          <p className="text-ink-muted text-sm">Paste inspection results JSON (pointCode + status or measuredValue). Nothing is persisted.</p>
          <textarea
            aria-label="Preview results JSON"
            value={resultsJson}
            onChange={(e) => setResultsJson(e.target.value)}
            rows={6}
            className="font-mono text-xs rounded-sm border border-line bg-chassis text-ink p-2"
          />
          <button type="button" onClick={runPreview} className="h-9 px-3 self-start rounded-sm bg-primary text-white text-sm font-medium">
            Preview score
          </button>
          {preview && (
            <div className="flex flex-col gap-1 text-sm text-ink" data-testid="preview-result">
              <p className="font-display text-3xl">{preview.score} <span className="text-base text-ink-muted">({preview.band}, raw {preview.rawScore})</span></p>
              {preview.overrideApplied !== "NONE" && <p className="text-danger">Override: {preview.overrideApplied}</p>}
              <ul className="text-ink-muted">
                {preview.categoryScores.map((c) => (
                  <li key={c.categoryCode}>{c.label}: {c.score} (w{c.weight})</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
