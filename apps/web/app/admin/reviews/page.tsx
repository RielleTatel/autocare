"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/Button";
import { listBillingReviews, type BillingReview } from "../../../lib/billing/reviews";
import { errorMessage, formatPeso } from "../../../lib/staff-api";

export default function BillingReviewsPage() {
  const [reviews, setReviews] = useState<BillingReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try { setReviews(await listBillingReviews()); } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl text-ink">Work awaiting review</h1><p className="mt-1 max-w-2xl text-sm text-ink-muted">Verify completed work, service coverage, and the final repair amount before issuing a bill.</p></div><Button disabled={busy} variant="secondary" onClick={() => void load()}>Refresh queue</Button></header>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!reviews && !error && <p role="status" className="text-sm text-ink-muted">Loading review queue…</p>}
    {reviews && <section className="divide-y divide-line rounded-md border border-line bg-surface" aria-label="Work for admin review">
      {reviews.map(review => <Link href={`/admin/reviews/${review.appointmentId}`} key={review.appointmentId} className="flex min-h-24 flex-wrap items-center justify-between gap-4 p-4 hover:bg-chassis focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <div><h2 className="font-medium text-ink">{review.vehiclePlateNo} · {review.service.name}</h2><p className="mt-1 text-sm text-ink-muted">{review.repair ? (review.repair.outcome.toUpperCase().includes("STOP") ? "Stopped repair" : "Completed repair") : "Service without additional repairs"}</p><p className="text-sm text-ink-muted">{review.service.alreadyBilled ? "Original service already billed" : review.service.legacyProvenance ? "Original price or coverage needs explicit review" : review.service.covered ? "Original service covered" : `Original service ${review.service.chargeCentavos == null ? "amount unavailable" : formatPeso(review.service.chargeCentavos)}`}</p></div>
        <div className="text-right"><p className="text-sm text-ink">{review.invoiceId ? "Bill issued" : review.status.replaceAll("_", " ").toLowerCase()}</p>{review.repair && <p className="text-sm text-ink-muted">Repair estimate {formatPeso(review.repair.estimatedTotalCentavos)}</p>}<span className="mt-2 inline-block text-sm font-medium text-primary">Open review</span></div>
      </Link>)}
      {reviews.length === 0 && <p className="p-5 text-sm text-ink-muted">No work is waiting for review. Completed services and completed or stopped repairs will appear here.</p>}
    </section>}
  </div>;
}
