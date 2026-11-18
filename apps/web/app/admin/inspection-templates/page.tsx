"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { createInspectionTemplate, listInspectionTemplates, type InspectionTemplate } from "../../../lib/inspection-templates/api";
import { errorMessage } from "../../../lib/staff-api";

export default function InspectionTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<InspectionTemplate[] | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"FULL" | "FOCUSED">("FOCUSED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { setTemplates(await listInspectionTemplates()); } catch (e) { setError(errorMessage(e)); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function create() {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try { const template = await createInspectionTemplate(name.trim(), scope); router.push(`/admin/inspection-templates/${template.id}`); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl text-ink">Inspection templates</h1><p className="mt-1 max-w-2xl text-sm text-ink-muted">Publish reusable checks, then assign a published version to a service.</p></div><Link className="min-h-12 inline-flex items-center text-sm font-medium text-primary" href="/admin/services">Manage services</Link></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void create(); }} className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
      <h2 className="font-display text-xl text-ink">Create a template</h2>
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm text-ink">Template name<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} className="h-12 rounded-sm border border-line bg-chassis px-3" /></label><label className="flex flex-col gap-1 text-sm text-ink">Inspection scope<select value={scope} onChange={event => setScope(event.target.value as "FULL" | "FOCUSED")} className="h-12 rounded-sm border border-line bg-chassis px-3"><option value="FOCUSED">Focused inspection</option><option value="FULL">Full vehicle inspection</option></select></label></div>
      <p className="max-w-2xl text-sm text-ink-muted">{scope === "FOCUSED" ? "Choose checks from any category for a particular service. Focused results describe only the systems inspected." : "Full templates cover the designated complete vehicle checklist. Publication validates full inspection requirements."}</p>
      <div><Button type="submit" disabled={busy || !name.trim()}>{busy ? "Creating template…" : "Create template"}</Button></div>
    </form>
    {!templates && !error && <p role="status" className="text-sm text-ink-muted">Loading templates…</p>}
    {templates && <section className="divide-y divide-line rounded-md border border-line bg-surface" aria-label="Reusable inspection templates">{templates.map(template => <Link href={`/admin/inspection-templates/${template.id}`} key={template.id} className="flex min-h-20 flex-wrap items-center justify-between gap-3 p-4 hover:bg-chassis"><div><h2 className="font-medium text-ink">{template.name}</h2><p className="text-sm text-ink-muted">{template.scope === "FULL" ? "Full vehicle inspection" : "Focused inspection"}</p></div><div className="text-right text-sm"><p className="text-ink">{template.versions.filter(version => version.status === "PUBLISHED").length} published versions</p><p className="font-medium text-primary">{template.versions.some(version => version.status === "DRAFT") ? "Continue draft" : "View template"}</p></div></Link>)}{templates.length === 0 && <p className="p-5 text-sm text-ink-muted">Create a template to define the checks for a service.</p>}</section>}
    <Link className="text-sm text-primary" href="/admin/checklists">Legacy checklist versions</Link>
  </div>;
}
