"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInStaff } from "../../lib/auth/firebase";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";

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
      <div
        className="w-full max-w-sm rounded-md border border-line bg-surface p-8"
        style={{ boxShadow: "var(--ac-elevation-raised)" }}
      >
        <h1 className="font-display text-primary-deep text-3xl font-semibold mb-1">AutoCare+</h1>
        <p className="text-ink-muted text-sm mb-6">Staff console</p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Email" type="email" value={email} onChange={setEmail} />
          <FormField label="Password" type="password" value={password} onChange={setPassword} />

          {error && <p className="text-danger text-sm">{error}</p>}

          <Button type="submit" block disabled={submitting || !email || !password}>
            Sign in
          </Button>
        </form>

        <p className="text-ink-muted text-xs mt-6">Staff access only. Members use the mobile app.</p>
      </div>
    </main>
  );
}
