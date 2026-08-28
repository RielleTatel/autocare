"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { getActiveChecklist, type EditorCategory } from "../../lib/checklists/api";

/** The active checklist's category weights at a glance, with a way into the editor. */
export function ChecklistWeightsCard() {
  const [categories, setCategories] = useState<EditorCategory[] | null>(null);

  useEffect(() => {
    let live = true;
    getActiveChecklist()
      .then((c) => { if (live) setCategories(c.categories); })
      .catch(() => { if (live) setCategories([]); });
    return () => { live = false; };
  }, []);

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Checklist editor</h2>
      <div className="flex flex-col">
        {(categories ?? []).map((c) => (
          <div key={c.code} className="flex items-center justify-between border-t border-line py-2 text-sm">
            <span className="text-ink">{c.label}</span>
            <span className="inline-flex gap-3 font-mono text-xs tabular-nums text-ink-muted">
              <span>{c.weight}%</span>
              <span>{c.points.length} points</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Weights are versioned — editing creates a new checklist version.
      </p>
      <Link href="/admin/checklists" className="mt-2 block">
        <Button variant="secondary" block>Edit weights</Button>
      </Link>
    </Card>
  );
}
