// Public certificate verification route — placeholder shell (wired in a later phase).
export default function CertificatePage({ params }: { params: { token: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-chassis px-4">
      <div className="w-full max-w-md bg-surface rounded-md border border-line p-8 text-center">
        <h1 className="font-display text-primary-deep text-2xl font-semibold mb-2">Certificate</h1>
        <p className="text-ink-muted text-sm">
          Verification code <span className="font-mono">{params.token}</span> — coming soon.
        </p>
      </div>
    </main>
  );
}
