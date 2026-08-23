"use client";

import { useState } from "react";
import { bandInfo, type PublicCertificate } from "../../../lib/certificates/public";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/** P-02 — verify a certificate by its printed code. Hits the @Public() verify
 *  endpoint directly (no session). */
export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PublicCertificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/public/certificates/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(res.status === 410 ? "This certificate has been revoked." : "No certificate matches that code.");
        return;
      }
      setResult(body.data as PublicCertificate);
    } catch {
      setError("Could not reach the verification service. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const info = result ? bandInfo(result.band) : null;

  return (
    <main className="min-h-screen bg-chassis px-4 py-10">
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <h1 className="font-display text-primary-deep text-2xl font-semibold text-center">Verify a health certificate</h1>
        <p className="text-ink-muted text-sm text-center">Enter the 8-character code printed on the certificate.</p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            aria-label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 7K2M9QX4"
            maxLength={8}
            className="flex-1 h-11 px-3 rounded-sm border border-line bg-surface text-ink font-mono uppercase"
          />
          <button type="submit" disabled={loading || code.trim().length < 4} className="h-11 px-4 rounded-sm bg-primary text-white font-medium disabled:opacity-50">
            {loading ? "…" : "Verify"}
          </button>
        </form>
        {error && <p className="text-danger text-sm text-center" role="alert">{error}</p>}
        {result && info && (
          <div className="bg-surface rounded-md border border-line p-6 text-center flex flex-col gap-1">
            <p className="text-ink-muted text-sm">Verified certificate</p>
            <p className="font-display text-5xl" style={{ color: info.text }}>{result.score}</p>
            <p className="font-display text-lg" style={{ color: info.text }}>{info.labelEn}</p>
            <p className="text-ink text-sm mt-2">Plate <span className="font-mono">{result.plateNo}</span></p>
            <p className="text-ink-muted text-sm">Inspected {new Date(result.inspectionDate).toLocaleDateString()}</p>
            {result.isStale && <p className="text-ink-muted text-sm">Inspected {result.daysSinceInspection} days ago — may be out of date.</p>}
          </div>
        )}
      </div>
    </main>
  );
}
