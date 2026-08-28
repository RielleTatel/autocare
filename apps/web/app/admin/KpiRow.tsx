"use client";

import { useEffect, useState } from "react";
import { Card } from "../../components/Card";
import { getAnalyticsSummary, type AnalyticsSummary } from "../../lib/analytics/api";

const pesos = (centavos: string) =>
  `₱${Math.round(Number(centavos) / 100).toLocaleString("en-PH")}`;
const pct = (ratio: number, dp = 0) => `${(ratio * 100).toFixed(dp)}%`;

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card pad="lg">
      <div className="font-body text-xs uppercase tracking-[0.03em] text-ink-muted">{label}</div>
      <div className="font-display text-[34px] font-semibold leading-tight tabular-nums text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{note}</div>
    </Card>
  );
}

/** The four numbers an owner opens the console for. Fails on its own — a dead
 *  analytics call must not blank the rest of the dashboard. */
export function KpiRow() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getAnalyticsSummary()
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (failed) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-danger">Could not load the numbers</h2>
        <p className="mt-1 text-sm text-ink-muted">The analytics service did not respond. Reload to try again.</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Card key={n} pad="lg">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-line" aria-busy="true" />
            <div className="mt-2 h-8 w-1/2 animate-pulse rounded-sm bg-line" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="MRR" value={pesos(data.mrrCentavos)} note="active, grace and past-due plans" />
      <Kpi label="Active members" value={data.activeMembers.toLocaleString("en-PH")} note="distinct members under contract" />
      <Kpi label="Churn (30d)" value={pct(data.churn30d, 1)} note="cancelled in the last 30 days" />
      <Kpi label="Bay utilisation" value={pct(data.bayUtilisation)} note="mean, next 14 days" />
    </div>
  );
}
