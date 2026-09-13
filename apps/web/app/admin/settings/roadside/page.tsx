"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../../components/Button";
import {
  getRoadsideEligibilityConfig,
  updateRoadsideEligibilityConfig,
  type RoadsideEligibilityConfig,
} from "../../../../lib/roadside/admin-config-api";

export default function RoadsideSettingsPage() {
  const [config, setConfig] = useState<RoadsideEligibilityConfig | null>(null);
  const [waitingDays, setWaitingDays] = useState("30");
  const [requireClearedPayment, setRequireClearedPayment] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRoadsideEligibilityConfig()
      .then((value) => {
        setConfig(value);
        setWaitingDays(String(value.waitingDays));
        setRequireClearedPayment(value.requireClearedPayment);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load roadside settings."));
  }, []);

  const parsedDays = Number(waitingDays);
  const valid = Number.isInteger(parsedDays) && parsedDays >= 0 && parsedDays <= 365 && reason.trim().length >= 5;
  const needsWarning = parsedDays === 0 || !requireClearedPayment;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateRoadsideEligibilityConfig({ waitingDays: parsedDays, requireClearedPayment, reason: reason.trim() });
      setConfig(updated);
      setWaitingDays(String(updated.waitingDays));
      setRequireClearedPayment(updated.requireClearedPayment);
      setReason("");
      setConfirming(false);
      setMessage("Roadside eligibility settings saved. New eligibility checks use this policy immediately.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save roadside settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-2xl">
      <header className="space-y-1">
        <Link href="/admin" className="text-primary text-sm font-medium">← Admin dashboard</Link>
        <h1 className="font-display text-2xl text-ink">Roadside eligibility</h1>
        <p className="text-sm text-ink-muted">Set the global policy used when members request roadside assistance.</p>
      </header>

      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
      {message && <p role="status" className="text-success text-sm">{message}</p>}

      {!config ? (
        <p className="text-ink-muted text-sm">Loading settings…</p>
      ) : (
        <section className="rounded-md border border-line bg-surface p-4 space-y-4">
          <label className="block text-sm text-ink-muted" htmlFor="waiting-days">
            Waiting period after eligibility base date (days)
            <input
              id="waiting-days"
              aria-label="Roadside waiting period in days"
              type="number"
              min={0}
              max={365}
              step={1}
              className="mt-1 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-ink"
              value={waitingDays}
              onChange={(e) => setWaitingDays(e.target.value)}
            />
            <span className="mt-1 block text-xs">Set to 0 to unlock roadside immediately once the eligibility base condition is met.</span>
          </label>

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              aria-label="Require cleared payment"
              type="checkbox"
              checked={requireClearedPayment}
              onChange={(e) => setRequireClearedPayment(e.target.checked)}
            />
            <span>
              Require a successful first payment
              <span className="block text-xs text-ink-muted">When disabled, the waiting period begins when the subscription starts.</span>
            </span>
          </label>

          <label className="block text-sm text-ink-muted" htmlFor="reason">
            Reason for this change (recorded in audit history)
            <textarea
              id="reason"
              aria-label="Reason for roadside policy change"
              rows={3}
              className="mt-1 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-ink"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Example: waive waiting period for launch promotion"
            />
          </label>

          {needsWarning && (
            <p role="note" className="rounded-sm border border-warning bg-warning/10 p-3 text-sm text-ink">
              This change can make roadside assistance available immediately to eligible members. It takes effect for all future eligibility checks.
            </p>
          )}

          {confirming ? (
            <div className="rounded-sm border border-line p-3 space-y-3">
              <p className="text-sm text-ink">Confirm: save a {parsedDays}-day waiting period with payment requirement {requireClearedPayment ? "enabled" : "disabled"}?</p>
              <div className="flex gap-3">
                <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Confirm save"}</Button>
                <button type="button" className="text-sm text-ink-muted" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <Button disabled={!valid || busy} onClick={() => setConfirming(true)}>Review changes</Button>
          )}
        </section>
      )}
    </main>
  );
}
