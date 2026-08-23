import type { Metadata } from "next";
import { fetchPublicCertificate, bandInfo, type PublicCertificate } from "../../../../lib/certificates/public";
import { RevokedNotice } from "./revoked";

export const revalidate = 300;

/** Server-rendered SVG gauge — same 180° geometry as the RN ScoreGauge. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const s = polar(cx, cy, r, fromDeg);
  const e = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function Gauge({ score, band, stale }: { score: number; band: string; stale: boolean }) {
  const size = 260, stroke = 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const clamped = Math.max(0, Math.min(100, score));
  const progressDeg = 180 - (clamped / 100) * 180;
  const info = bandInfo(band);
  const color = stale ? "#51616F" : info.fill;
  return (
    <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`} role="img" aria-label={`Score ${clamped} out of 100, ${info.labelEn}`}>
      <path d={arcPath(cx, cy, r, 180, 0)} stroke="#D5DBE0" strokeWidth={stroke} fill="none" strokeLinecap="round" />
      {clamped > 0 && <path d={arcPath(cx, cy, r, 180, progressDeg)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="56" fontWeight="700" fill={stale ? "#51616F" : info.text} fontFamily="Barlow Semi Condensed, system-ui, sans-serif">{clamped}</text>
    </svg>
  );
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const result = await fetchPublicCertificate(params.token);
  if (result.state !== "ok") {
    return { title: "AutoCare+ Certificate", robots: { index: false } };
  }
  const info = bandInfo(result.cert.band);
  return {
    title: `VHS ${result.cert.score} — ${info.labelEn}`,
    description: `AutoCare+ Vehicle Health Certificate for ${result.cert.plateNo}, inspected ${new Date(result.cert.inspectionDate).toLocaleDateString()}.`,
    openGraph: {
      title: `VHS ${result.cert.score} — ${info.labelEn}`,
      description: `Inspected ${new Date(result.cert.inspectionDate).toLocaleDateString()} · ${result.cert.plateNo}`,
    },
  };
}

export default async function CertificatePage({ params }: { params: { token: string } }) {
  const result = await fetchPublicCertificate(params.token);
  if (result.state === "revoked") return <RevokedNotice />;
  if (result.state === "not_found") return <RevokedNotice notFound />;
  return <Certificate cert={result.cert} />;
}

function Certificate({ cert }: { cert: PublicCertificate }) {
  const info = bandInfo(cert.band);
  return (
    <main className="min-h-screen bg-chassis px-4 py-8">
      <div className="max-w-lg mx-auto flex flex-col gap-5">
        <div className="bg-surface rounded-md border border-line overflow-hidden">
          <div className="bg-[#0A2E4F] px-6 py-4 text-center">
            <h1 className="font-display text-white text-xl font-semibold">AutoCare+ Vehicle Health Certificate</h1>
          </div>
          <div className="flex flex-col items-center px-6 py-6 gap-1">
            <Gauge score={cert.score} band={cert.band} stale={cert.isStale} />
            <p className="font-display text-2xl" style={{ color: cert.isStale ? "#51616F" : info.text }}>{info.labelEn}</p>
            <p className="text-ink-muted text-sm">{info.labelFil}</p>
            {cert.isStale && (
              <p className="mt-2 text-sm text-ink-muted text-center">
                Inspected {cert.daysSinceInspection} days ago — request a fresh inspection.
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-line grid grid-cols-2 gap-3 text-sm">
            <Field label="Plate" value={cert.plateNo} mono />
            <Field label="Odometer" value={cert.odometerKm != null ? `${cert.odometerKm.toLocaleString()} km` : "—"} />
            <Field label="Inspected" value={new Date(cert.inspectionDate).toLocaleDateString()} />
            <Field label="Valid until" value={new Date(cert.validUntil).toLocaleDateString()} />
            <Field label="Confidence" value={titleCase(cert.confidence)} />
            <Field label="Verification code" value={cert.verificationCode} mono />
          </div>

          <div className="px-6 py-4 border-t border-line flex flex-col gap-2">
            <h2 className="font-display text-lg text-ink">Category scores</h2>
            {cert.categoryScores.map((c) => {
              const ci = bandInfo(bandForScore(c.score));
              return (
                <div key={c.categoryCode} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm text-ink">
                    <span>{c.label}</span>
                    <span style={{ color: ci.text }}>{Math.round(c.score)}</span>
                  </div>
                  <div className="h-2 rounded-pill bg-chassis overflow-hidden">
                    <div className="h-full rounded-pill" style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, backgroundColor: ci.fill }} />
                  </div>
                </div>
              );
            })}
          </div>

          {cert.serviceSummary.count > 0 && (
            <div className="px-6 py-4 border-t border-line">
              <h2 className="font-display text-lg text-ink">Service history</h2>
              <p className="text-ink-muted text-sm mb-2">{cert.serviceSummary.count} completed service{cert.serviceSummary.count === 1 ? "" : "s"} on record</p>
              <ul className="text-sm text-ink flex flex-col gap-1">
                {cert.serviceSummary.recent.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{s.type}</span>
                    <span className="text-ink-muted">{new Date(s.date).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="text-ink-muted text-xs text-center px-4">
          This certificate reflects a point-in-time inspection and is valid for 90 days.
          Verify its authenticity at <span className="font-mono">/verify</span> using the code above.
        </p>
        <div className="bg-[#0A2E4F] rounded-md py-3 text-center">
          <p className="text-white text-sm">Powered by AutoCare+ · autocare.example/verify</p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-ink-muted text-xs">{label}</span>
      <span className={`text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function bandForScore(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "CRITICAL";
}
