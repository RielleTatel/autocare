"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../../components/Button";
import { ChecklistDefinitionEditor } from "../../../../components/ChecklistDefinitionEditor";
import { getChecklist, type EditorCategory } from "../../../../lib/checklists/api";
import { createTemplateVersion, getInspectionTemplate, listInspectionTemplates, publishTemplateVersion, saveTemplateVersion, type InspectionTemplate, type TemplateVersion } from "../../../../lib/inspection-templates/api";
import { errorMessage } from "../../../../lib/staff-api";

export default function InspectionTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [versionId, setVersionId] = useState("");
  const [version, setVersion] = useState<TemplateVersion | null>(null);
  const [categories, setCategories] = useState<EditorCategory[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [sourceCategories, setSourceCategories] = useState<EditorCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  const selectVersion = useCallback(async (next: TemplateVersion) => {
    const definition = next.categories ?? (await getChecklist(next.id)).categories;
    setVersion(next); setVersionId(next.id); setCategories(definition); setDirty(false);
  }, []);
  const load = useCallback(async (preferredId?: string) => {
    const [current, all] = await Promise.all([getInspectionTemplate(id), listInspectionTemplates()]);
    setTemplate(current); setTemplates(all);
    const currentVersion = current.versions.find(item => item.id === preferredId) ?? current.versions.find(item => item.status === "DRAFT") ?? current.versions[0];
    if (currentVersion) await selectVersion(currentVersion);
    else { setVersion(null); setVersionId(""); setCategories([]); }
  }, [id, selectVersion]);
  useEffect(() => { setTemplate(null); setError(null); void load().catch(e => setError(errorMessage(e))); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editable = version?.status === "DRAFT";
  async function newDraft() {
    setBusy(true); setError(null); setMessage(null);
    try { const next = await createTemplateVersion(id, version?.id); await load(next.versions.find(item => item.status === "DRAFT")?.id); setMessage("Draft created. Published versions remain unchanged."); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function save(publish = false) {
    if (!version || !editable) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await saveTemplateVersion(id, version.id, categories);
      setDirty(false);
      if (publish) await publishTemplateVersion(id, version.id);
      await load(version.id);
      setMessage(publish ? "Version published. Assign this version to a service for new bookings." : "Draft saved.");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function changeVersion(nextId: string) {
    const next = template?.versions.find(item => item.id === nextId);
    if (!next) return;
    setBusy(true); setError(null); setMessage(null);
    try { await selectVersion(next); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function source(nextId: string) {
    setSourceId(nextId); setSourceCategories([]); setSelected([]); setError(null);
    if (!nextId) return;
    setBusy(true);
    try { setSourceCategories((await getChecklist(nextId)).categories); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  function copyChecks() {
    const codes = new Set(categories.flatMap(item => item.points.map(check => check.code)));
    const next = structuredClone(categories);
    for (const category of sourceCategories) {
      const points = category.points.filter(check => selected.includes(check.code) && !codes.has(check.code));
      if (!points.length) continue;
      points.forEach(check => codes.add(check.code));
      const existing = next.find(item => item.code === category.code);
      if (existing) existing.points.push(...structuredClone(points));
      else next.push({ ...structuredClone(category), points: structuredClone(points) });
    }
    setCategories(next); setDirty(true); setSelected([]); setSourceId(""); setSourceCategories([]);
    setMessage("Checks copied. Review category and check weights before publication.");
  }

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl text-ink">{template?.name ?? "Inspection template"}</h1>{template && <p className="text-sm text-ink-muted">{template.scope === "FULL" ? "Full vehicle inspection" : "Focused inspection"}</p>}</div><Link href="/admin/inspection-templates" className="min-h-12 inline-flex items-center text-sm font-medium text-primary">Back to templates</Link></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
    {!template && <div><p className="text-sm text-ink-muted">{error ? "Template could not be loaded." : "Loading template…"}</p>{error && <Button variant="secondary" onClick={() => void load().catch(e => setError(errorMessage(e)))}>Try again</Button>}</div>}
    {template && <>
      <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><label className="flex min-w-48 flex-col gap-1 text-sm text-ink">Version<select disabled={busy || dirty} value={versionId} onChange={event => void changeVersion(event.target.value)} className="h-12 rounded-sm border border-line bg-chassis px-3">{template.versions.length === 0 && <option value="">No versions yet</option>}{template.versions.map(item => <option key={item.id} value={item.id}>{item.versionLabel} · {item.status.toLowerCase()}</option>)}</select></label><div className="flex flex-wrap gap-2">{editable ? <><Button disabled={busy} variant="secondary" onClick={() => void save()}>Save draft</Button><Button disabled={busy || categories.length === 0} onClick={() => void save(true)}>Save and publish</Button></> : <Button disabled={busy || template.versions.some(item => item.status === "DRAFT")} onClick={() => void newDraft()}>Create draft version</Button>}</div></div>
        <p className="text-sm text-ink-muted">{dirty ? "Unsaved changes. Save this draft before switching versions." : editable ? "Draft changes affect new bookings only after publication and service assignment." : "Published definitions are read-only. Existing bookings retain their assigned version."}</p>
      </section>
      {editable && <details className="rounded-md border border-line bg-surface p-4"><summary className="min-h-10 cursor-pointer font-medium text-ink">Copy checks from a published template</summary><div className="mt-3 flex flex-col gap-3"><label className="flex flex-col gap-1 text-sm text-ink">Source version<select disabled={busy} value={sourceId} onChange={event => void source(event.target.value)} className="h-12 rounded-sm border border-line bg-chassis px-3"><option value="">Choose a published version</option>{templates.flatMap(item => item.versions.filter(v => v.status === "PUBLISHED").map(v => <option key={v.id} value={v.id}>{item.name} · {v.versionLabel}</option>))}</select></label>{sourceCategories.map(cat => <fieldset key={cat.code} className="rounded-sm border border-line p-3"><legend className="px-1 text-sm font-medium text-ink">{cat.label}</legend>{cat.points.map(check => { const exists = categories.some(item => item.points.some(p => p.code === check.code)); return <label key={check.code} className="flex min-h-12 items-center gap-2 text-sm text-ink"><input type="checkbox" checked={selected.includes(check.code)} disabled={exists || busy} onChange={event => setSelected(previous => event.target.checked ? [...previous, check.code] : previous.filter(code => code !== check.code))} />{check.label}{exists ? " (already included)" : ""}</label>; })}</fieldset>)}{sourceCategories.length > 0 && <div><Button disabled={busy || selected.length === 0} variant="secondary" onClick={copyChecks}>Copy selected checks</Button></div>}</div></details>}
      {version && <ChecklistDefinitionEditor categories={categories} disabled={!editable || busy} onChange={next => { setCategories(next); setDirty(true); setMessage(null); }} />}
      {editable && categories.length === 0 && <p className="text-sm text-ink-muted">Add a category and checks, or copy selected checks from a published template.</p>}
    </>}
  </div>;
}
