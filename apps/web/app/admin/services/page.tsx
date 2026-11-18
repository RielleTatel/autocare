"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { listInspectionTemplates, type InspectionTemplate } from "../../../lib/inspection-templates/api";
import { createConfiguredService, listConfiguredServices, updateConfiguredService, type ConfiguredService, type ServiceInput } from "../../../lib/inspection-templates/services";
import { errorMessage, formatPeso, parsePeso, pesoInput } from "../../../lib/staff-api";

type Form = { id: string | null; code: string; name: string; duration: string; skills: string; price: string; templateVersionId: string };
const blank: Form = { id: null, code: "", name: "", duration: "60", skills: "", price: "0.00", templateVersionId: "" };
const control = "h-12 rounded-sm border border-line bg-chassis px-3 text-sm text-ink";

export default function ServiceSettingsPage() {
  const [services, setServices] = useState<ConfiguredService[] | null>(null);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [current, definitions] = await Promise.all([listConfiguredServices(), listInspectionTemplates()]);
    setServices(current); setTemplates(definitions);
  }, []);
  useEffect(() => { void load().catch(e => setError(errorMessage(e))); }, [load]);
  function edit(service: ConfiguredService) {
    setForm({ id: service.id, code: service.code, name: service.name, duration: String(service.standardDurationMin), skills: (service.requiredSkills ?? []).join(", "), price: pesoInput(Number(service.priceCentavos)), templateVersionId: service.inspectionTemplateVersionId ?? (service.inspectionRequired ? "__missing" : "") });
    setError(null); setMessage(null);
    document.getElementById("service-settings-form")?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  async function save() {
    const price = parsePeso(form.price);
    const duration = Number(form.duration);
    if (!form.name.trim() || !form.code.trim()) { setError("Enter a service name and code."); return; }
    if (!Number.isSafeInteger(duration) || duration <= 0) { setError("Enter a whole number of minutes greater than zero."); return; }
    if (price === null) { setError("Enter the service price in pesos, with up to two decimal places."); return; }
    if (form.templateVersionId === "__missing") { setError("Choose a published inspection template, or select No inspection."); return; }
    if (form.templateVersionId && !versions.some(version => version.id === form.templateVersionId)) { setError("The assigned template is unavailable. Choose an active published version, or select No inspection."); return; }
    const input: ServiceInput = { code: form.code.trim(), name: form.name.trim(), standardDurationMin: duration, requiredSkills: form.skills.split(",").map(item => item.trim()).filter(Boolean), priceCentavos: price, inspectionRequired: Boolean(form.templateVersionId), inspectionTemplateVersionId: form.templateVersionId || null };
    setBusy(true); setError(null); setMessage(null);
    try { if (form.id) await updateConfiguredService(form.id, input); else await createConfiguredService(input); await load(); setForm(blank); setMessage("Service saved. New bookings use this configuration."); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const versions = templates.filter(template => template.isActive).flatMap(template => template.versions.filter(version => version.status === "PUBLISHED").map(version => ({ id: version.id, label: `${template.name} · ${version.versionLabel} · ${template.scope === "FULL" ? "Full" : "Focused"}` })));
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl text-ink">Services and inspection scope</h1><p className="mt-1 text-sm text-ink-muted">Set the booked price and choose the published checks for each service.</p></div><Link href="/admin/inspection-templates" className="min-h-12 inline-flex items-center text-sm font-medium text-primary">Manage inspection templates</Link></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
    {!services && <div><p className="text-sm text-ink-muted">{error ? "Service configuration could not be loaded." : "Loading services…"}</p>{error && <Button variant="secondary" onClick={() => void load().catch(e => setError(errorMessage(e)))}>Try again</Button>}</div>}
    {services && <section className="divide-y divide-line rounded-md border border-line bg-surface" aria-label="Service configuration">{services.map(service => { const selected = versions.find(version => version.id === service.inspectionTemplateVersionId); const missing = service.inspectionRequired && !selected; return <div key={service.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-medium text-ink">{service.name}</h2><p className="text-sm text-ink-muted">{service.standardDurationMin} minutes · {formatPeso(Number(service.priceCentavos))}</p><p className={`mt-1 text-sm ${missing ? "text-danger" : "text-ink-muted"}`}>{service.inspectionConfigurationProblem ?? (missing ? "Configuration needed: assign a published inspection template." : selected ? selected.label : "No inspection")}</p></div><Button variant="secondary" disabled={busy} onClick={() => edit(service)}>Edit service</Button></div>; })}{services.length === 0 && <p className="p-5 text-sm text-ink-muted">No services yet. Create a service below and choose its inspection scope.</p>}</section>}
    <form id="service-settings-form" onSubmit={event => { event.preventDefault(); void save(); }} className="scroll-mt-6 rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
      <h2 className="font-display text-xl text-ink">{form.id ? "Edit service" : "Create a service"}</h2>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm text-ink">Service name<input className={control} required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Service code<input className={control} required value={form.code} onChange={event => setForm({ ...form, code: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Duration (minutes)<input className={control} type="number" min={1} step={1} required value={form.duration} onChange={event => setForm({ ...form, duration: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Booked service price (₱)<input className={control} inputMode="decimal" required value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Required mechanic skills<input className={control} value={form.skills} onChange={event => setForm({ ...form, skills: event.target.value })} /><span className="text-xs text-ink-muted">Separate skills with commas.</span></label><label className="flex flex-col gap-1 text-sm text-ink">Inspection template<select className={control} value={form.templateVersionId} onChange={event => setForm({ ...form, templateVersionId: event.target.value })}><option value="">No inspection</option>{form.templateVersionId === "__missing" && <option value="__missing" disabled>Choose a published template</option>}{versions.map(version => <option key={version.id} value={version.id}>{version.label}</option>)}</select></label></fieldset>
      {versions.length === 0 && <p className="text-sm text-ink-muted">Publish an inspection template to make its checks available here. Services without inspections can be saved now.</p>}
      <p className="max-w-2xl text-sm text-ink-muted">Existing bookings keep their original checklist, price, and coverage. Subscription coverage is determined when the customer books.</p>
      <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "Saving service…" : "Save service"}</Button>{form.id && <Button variant="secondary" disabled={busy} onClick={() => { setForm(blank); setError(null); }}>Cancel editing</Button>}</div>
    </form>
  </div>;
}
