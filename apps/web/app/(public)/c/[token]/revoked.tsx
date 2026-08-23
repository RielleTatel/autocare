import Link from "next/link";

/** P-03 — revoked / unknown certificate notice. Rendered by the page for both
 *  the 410 (revoked) and 404 (unknown) states; the route returns the matching
 *  HTTP status via not-found handling. */
export function RevokedNotice({ notFound }: { notFound?: boolean }) {
  return (
    <main className="min-h-screen bg-chassis flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface rounded-md border border-line p-8 text-center flex flex-col gap-3">
        <div className="text-4xl">{notFound ? "🔍" : "⛔"}</div>
        <h1 className="font-display text-primary-deep text-2xl font-semibold">
          {notFound ? "Certificate not found" : "This certificate is no longer available"}
        </h1>
        <p className="text-ink-muted text-sm">
          {notFound
            ? "The link may be mistyped, or the certificate was never shared."
            : "The vehicle owner has revoked this certificate, so its details can no longer be viewed."}
        </p>
        <Link href="/verify" className="mt-2 text-primary font-medium">Verify a certificate by code →</Link>
      </div>
    </main>
  );
}
