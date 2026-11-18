"use client";

import { Button } from "./Button";
import type { EditorCategory, EditorPoint } from "../lib/checklists/api";

const control = "min-h-12 w-full rounded-sm border border-line bg-chassis px-3 text-sm text-ink";
const newCode = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

/** Definition-only editor: the same supported scoring fields as published checklists. */
export function ChecklistDefinitionEditor({ categories, onChange, disabled = false }: { categories: EditorCategory[]; onChange: (categories: EditorCategory[]) => void; disabled?: boolean }) {
  const category = (index: number, patch: Partial<EditorCategory>) => onChange(categories.map((item, i) => i === index ? { ...item, ...patch } : item));
  const point = (ci: number, pi: number, patch: Partial<EditorPoint>) => category(ci, { points: categories[ci].points.map((item, i) => i === pi ? { ...item, ...patch } : item) });
  function addPoint(ci: number) {
    category(ci, { points: [...categories[ci].points, { code: newCode("check"), label: "", labelFil: "", weightInCategory: 0, isSafetyCritical: false, inputType: "STATUS", recommendation: "", requiresPhotoOnAdverse: false }] });
  }
  const categoryTotal = categories.reduce((sum, item) => sum + item.weight, 0);
  return <div className="flex flex-col gap-5">
    <p className={`text-sm ${Math.abs(categoryTotal - 100) < 0.000001 ? "text-success" : "text-ink-muted"}`}>Category weights: {categoryTotal} / 100. Each category’s check weights must also total 100.</p>
    {categories.map((cat, ci) => <section key={cat.code} className="rounded-md border border-line bg-surface p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl text-ink">{cat.label || "New category"}</h2>{!disabled && <Button variant="ghost" onClick={() => onChange(categories.filter((_, i) => i !== ci))}>Remove category</Button>}</div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="flex flex-col gap-1 text-sm text-ink">Category name<input className={control} disabled={disabled} value={cat.label} onChange={event => category(ci, { label: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Filipino name<input className={control} disabled={disabled} value={cat.labelFil ?? ""} onChange={event => category(ci, { labelFil: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Category weight<input className={control} type="number" min={0} max={100} step="any" disabled={disabled} value={cat.weight} onChange={event => category(ci, { weight: Number(event.target.value) })} /></label></div>
      <p className="text-sm text-ink-muted">Check weights: {cat.points.reduce((sum, item) => sum + item.weightInCategory, 0)} / 100</p>
      <div className="divide-y divide-line border-y border-line">{cat.points.map((check, pi) => <details key={check.code} className="py-3" open={!check.label}>
        <summary className="min-h-10 cursor-pointer text-sm font-medium text-ink">{check.label || "New check"}<span className="ml-2 font-normal text-ink-muted">{check.inputType === "MEASURED" ? "Measured" : "Status"} · Weight {check.weightInCategory}</span></summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm text-ink">Check label<input className={control} disabled={disabled} value={check.label} onChange={event => point(ci, pi, { label: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Filipino label<input className={control} disabled={disabled} value={check.labelFil ?? ""} onChange={event => point(ci, pi, { labelFil: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Answer type<select className={control} disabled={disabled} value={check.inputType} onChange={event => point(ci, pi, { inputType: event.target.value as EditorPoint["inputType"], ...(event.target.value === "MEASURED" && !check.thresholds ? { thresholds: { direction: "HIGHER_BETTER", good: 0, monitor: 0, attention: 0 } } : {}) })}><option value="STATUS">Status</option><option value="MEASURED">Measured value</option></select></label><label className="flex flex-col gap-1 text-sm text-ink">Weight within category<input className={control} type="number" min={0} max={100} step="any" disabled={disabled} value={check.weightInCategory} onChange={event => point(ci, pi, { weightInCategory: Number(event.target.value) })} /></label></div>
          {check.inputType === "MEASURED" && <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm text-ink">Unit<input className={control} disabled={disabled} value={check.unit ?? ""} maxLength={16} onChange={event => point(ci, pi, { unit: event.target.value })} /></label><label className="flex flex-col gap-1 text-sm text-ink">Healthy direction<select className={control} disabled={disabled} value={check.thresholds?.direction ?? "HIGHER_BETTER"} onChange={event => point(ci, pi, { thresholds: { ...check.thresholds!, direction: event.target.value as "HIGHER_BETTER" | "LOWER_BETTER" } })}><option value="HIGHER_BETTER">Higher is better</option><option value="LOWER_BETTER">Lower is better</option></select></label>{(["good", "monitor", "attention"] as const).map(threshold => <label key={threshold} className="flex flex-col gap-1 text-sm text-ink">{threshold.charAt(0).toUpperCase() + threshold.slice(1)} threshold<input type="number" step="any" disabled={disabled} className={control} value={check.thresholds?.[threshold] ?? ""} onChange={event => point(ci, pi, { thresholds: { ...check.thresholds!, [threshold]: Number(event.target.value) } })} /></label>)}</div>}
          <label className="flex min-h-12 items-center gap-2 text-sm text-ink"><input type="checkbox" disabled={disabled} checked={check.isSafetyCritical} onChange={event => point(ci, pi, { isSafetyCritical: event.target.checked })} />Safety critical check</label>
          <label className="flex flex-col gap-1 text-sm text-ink">Recommended action<textarea rows={2} disabled={disabled} className={`${control} py-3`} value={check.recommendation} onChange={event => point(ci, pi, { recommendation: event.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm text-ink">When this check does not apply (optional)<input disabled={disabled} className={control} value={check.notApplicableWhen ?? ""} onChange={event => point(ci, pi, { notApplicableWhen: event.target.value })} /></label>
          <details className="text-sm"><summary className="min-h-10 cursor-pointer text-ink-muted">Result guidance (optional)</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{["GOOD", "MONITOR", "ATTENTION", "CRITICAL"].map(status => <label key={status} className="flex flex-col gap-1 text-ink">{status.charAt(0) + status.slice(1).toLowerCase()} guidance<textarea rows={2} disabled={disabled} className={`${control} py-3`} value={check.templates?.[status] ?? ""} onChange={event => point(ci, pi, { templates: { ...check.templates, [status]: event.target.value } })} /></label>)}</div></details>
          {!disabled && <div><Button variant="ghost" onClick={() => category(ci, { points: cat.points.filter((_, i) => i !== pi) })}>Remove check</Button></div>}
        </div>
      </details>)}</div>
      {!disabled && <div><Button variant="secondary" onClick={() => addPoint(ci)}>Add check</Button></div>}
    </section>)}
    {!disabled && <div><Button variant="secondary" onClick={() => onChange([...categories, { code: newCode("category"), label: "", labelFil: "", weight: 0, points: [] }])}>Add category</Button></div>}
  </div>;
}
