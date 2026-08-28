"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../../components/Card";
import { BandChip } from "../../../../components/BandChip";
import { StarRating } from "../../../../components/StarRating";
import { CategoryBar } from "../../../../components/CategoryBar";
import { getHealthScore, type VehicleHealthScore } from "../../../../lib/inspections/api";

/** The advisor's score context for the vehicle in front of them. Degrades on its
 *  own — a vehicle with no inspection yet is a normal state, not an error. */
export function HealthScorePanel({ vehicleId }: { vehicleId: string | null }) {
  const [score, setScore] = useState<VehicleHealthScore | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    let live = true;
    getHealthScore(vehicleId)
      .then((s) => { if (live) setScore(s); })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; };
  }, [vehicleId]);

  if (!vehicleId) return null;

  if (missing) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-ink">No health score yet</h2>
        <p className="mt-1 text-sm text-ink-muted">This vehicle has not been inspected.</p>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card pad="lg">
        <h2 className="font-display text-lg text-ink">Health score</h2>
        <div className="mt-2 h-4 w-1/2 animate-pulse rounded-sm bg-line" aria-busy="true" />
      </Card>
    );
  }

  return (
    <Card pad="lg">
      <h2 className="mb-2 font-display text-lg text-ink">Health score</h2>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-[40px] leading-none font-semibold tabular-nums text-ink">
          {score.score}
        </span>
        <div>
          <BandChip band={score.band} />
          <div className="mt-1"><StarRating band={score.band} /></div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {score.categoryScores.map((c) => (
          <CategoryBar key={c.categoryCode} label={c.label} score={c.score} compact />
        ))}
      </div>
    </Card>
  );
}
