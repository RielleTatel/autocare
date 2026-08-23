"use client";

import type { DayUtilisation } from "../../lib/scheduling/api";

const THRESHOLD = 0.85;

/**
 * Forward capacity utilisation (FR-052) — a bar row per day with a threshold line; bars turn amber
 * as they approach and red once they breach. Presentational; the admin page loads the data.
 */
export function UtilisationWidget({ days }: { days: DayUtilisation[] }) {
  return (
    <section className="rounded-md border border-line bg-surface p-4" data-testid="utilisation-widget">
      <h2 className="font-display text-lg text-ink mb-3">Forward utilisation</h2>
      {days.length === 0 ? (
        <p className="text-ink-muted text-sm">No data.</p>
      ) : (
        <div className="flex items-end gap-1 h-32 relative">
          <div className="absolute left-0 right-0 border-t border-dashed border-danger" style={{ bottom: `${THRESHOLD * 100}%` }} aria-hidden />
          {days.map((d) => {
            const pct = Math.min(1, d.ratio) * 100;
            const breach = d.ratio > THRESHOLD;
            const warn = !breach && d.ratio >= THRESHOLD - 0.15;
            const color = breach ? "bg-danger" : warn ? "bg-band-fair" : "bg-primary";
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.booked}/${d.available} (${Math.round(d.ratio * 100)}%)`}>
                <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${pct}%` }} data-testid={`bar-${d.date}`} data-breach={breach ? "1" : "0"} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
