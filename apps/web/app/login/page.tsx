export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-chassis px-4">
      <div className="w-full max-w-sm bg-surface rounded-md border border-line p-8 shadow-sm">
        <h1 className="font-display text-primary-deep text-3xl font-semibold mb-1">AutoCare+</h1>
        <p className="text-ink-muted text-sm mb-6">Staff console</p>

        <form className="space-y-4">
          <label className="block">
            <span className="text-ink text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full h-11 rounded-sm border border-line px-3 text-ink"
            />
          </label>
          <label className="block">
            <span className="text-ink text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full h-11 rounded-sm border border-line px-3 text-ink"
            />
          </label>
          <button
            type="submit"
            disabled
            className="w-full h-12 rounded-sm bg-primary text-white font-medium disabled:opacity-60"
          >
            Sign in
          </button>
        </form>

        <p className="text-ink-muted text-xs mt-6">Staff access only. Members use the mobile app.</p>
      </div>
    </main>
  );
}
