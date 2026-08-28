"use client";

import { useEffect, useState } from "react";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { getWasteSummary, type WasteSummary } from "../../lib/analytics/api";

/** Calendar quarter to date — the window DENR reporting is filed on. */
function quarterToDate(): { from: string; to: string } {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3);
  const from = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

const prettyType = (t: string) => t.replace("_", " ").toLowerCase();

/** W-09 DENR reporting. The export is a regulator-facing document, so the card
 *  states plainly when it was last produced. */
export function WastePanel() {
  const [summary, setSummary] = useState<WasteSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const { from, to } = quarterToDate();

  useEffect(() => {
    let live = true;
    getWasteSummary(from, to)
      .then((s) => { if (live) setSummary(s); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [from, to]);

  if (failed) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-danger">Could not load waste records</h2>
      </Card>
    );
  }

  const totals = summary?.totals.map((t) => `${prettyType(t.wasteType)} ${t.quantity} ${t.unit}`).join(", ");

  return (
    <Card pad="lg">
      <h2 className="mb-1 font-display text-lg text-ink">Waste log export (DENR)</h2>
      <div className="flex items-center gap-4">
        <p className="flex-1 text-sm text-ink-muted">
          {summary === null
            ? "Loading this quarter's records…"
            : `${summary.recordCount} records this quarter${totals ? ` · ${totals}` : ""}. ` +
              (summary.lastExportedAt
                ? `Last export ${new Date(summary.lastExportedAt).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })}.`
                : "Never exported.")}
        </p>
        <a href={`/api/proxy/admin/waste/export?from=${from}&to=${to}`} download>
          <Button variant="secondary">Export CSV</Button>
        </a>
      </div>
    </Card>
  );
}
