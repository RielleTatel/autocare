"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInStaff } from "../../lib/auth/firebase";

const WRONG_CREDENTIALS = "Wrong email or password";
const STAFF_ONLY = "Staff access only. Members use the mobile app.";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const idToken = await signInStaff(email, password);
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error === "staff_only" ? STAFF_ONLY : WRONG_CREDENTIALS);
        return;
      }
      const { role } = await res.json();
      router.push(role === "ADMIN" ? "/admin" : "/staff");
    } catch {
      setError(WRONG_CREDENTIALS);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-chassis px-4">
      <div className="w-full max-w-sm bg-surface rounded-md border border-line p-8 shadow-sm">
        <h1 className="font-display text-primary-deep text-3xl font-semibold mb-1">AutoCare+</h1>
        <p className="text-ink-muted text-sm mb-6">Staff console</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-ink text-sm font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full h-11 rounded-sm border border-line px-3 text-ink"
            />
          </label>
          <label className="block">
            <span className="text-ink text-sm font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full h-11 rounded-sm border border-line px-3 text-ink"
            />
          </label>

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !email || !password}
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
