"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getStaff, setUserRole, ASSIGNABLE_ROLES, STAFF_ROLES, type StaffUser, type AssignableRole } from "../../../lib/users/api";
import { Button } from "../../../components/Button";

/**
 * Staff administration. Under /admin because the middleware gates that prefix to
 * ADMIN alone, matching the API: assigning a role is the only way in or out of
 * staff access, since sign-up always creates a MEMBER.
 *
 * Every change needs a written reason — the API rejects it otherwise, and the
 * reason is what the audit log records.
 */
export default function StaffAdminPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [scope, setScope] = useState<"STAFF" | "ALL">("STAFF");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<{ user: StaffUser; role: AssignableRole } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await getStaff({ q: query.trim() || undefined, scope }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load staff");
    }
  }, [query, scope]);

  useEffect(() => { void refresh(); }, [refresh]);

  const commit = async () => {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await setUserRole(pending.user.id, pending.role, reason);
      const cleared = res.clearedShifts > 0 ? ` ${res.clearedShifts} upcoming shift(s) were cancelled.` : "";
      setMsg(`${pending.user.name ?? "User"} is now ${pending.role}.${cleared}`);
      setPending(null);
      setReason("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change the role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-chassis px-6 py-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">Staff</h1>
          <Link href="/staff/schedule" className="text-primary text-sm font-medium">← Back to schedule</Link>
        </header>

        {msg && <p className="text-success text-sm">{msg}</p>}
        {err && <p className="text-danger text-sm">{err}</p>}

        <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-ink-muted text-xs flex flex-col gap-1 flex-1 min-w-[200px]">
              Search by name or email
              <input
                aria-label="Search staff"
                className="rounded-sm border border-line bg-surface px-2 py-1 text-ink"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="juan@…"
              />
            </label>
            <label className="text-ink-muted text-xs flex flex-col gap-1">
              Show
              <select
                aria-label="Directory scope"
                className="rounded-sm border border-line bg-surface px-2 py-1 text-ink"
                value={scope}
                onChange={(e) => setScope(e.target.value as "STAFF" | "ALL")}
              >
                <option value="STAFF">Staff only</option>
                <option value="ALL">Everyone (to promote a member)</option>
              </select>
            </label>
          </div>

          {scope === "ALL" && (
            <p className="text-ink-muted text-xs">
              A new hire has to sign in once on the member app before they appear here — sign-up
              always creates a member, and this is where they are given a staff role.
            </p>
          )}

          {users.length === 0 ? (
            <p className="text-ink-muted text-sm">Nobody matches that search.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-line px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-ink text-sm">{u.name ?? "Unnamed"}</div>
                    <div className="text-ink-muted text-xs truncate">{u.email ?? u.mobile ?? "no contact on file"}</div>
                  </div>
                  <span className="rounded-sm border border-line px-2 py-0.5 text-xs text-ink-muted">{u.role}</span>
                  {u.status !== "ACTIVE" && <span className="text-danger text-xs">{u.status}</span>}
                  {u.upcomingShifts > 0 && (
                    <span className="text-ink-muted text-xs">{u.upcomingShifts} upcoming shift{u.upcomingShifts === 1 ? "" : "s"}</span>
                  )}
                  <select
                    aria-label={`Assign role to ${u.name ?? u.id}`}
                    className="rounded-sm border border-line bg-surface px-2 py-1 text-ink text-sm"
                    value=""
                    onChange={(e) => {
                      const role = e.target.value as AssignableRole;
                      if (role) setPending({ user: u, role });
                      e.currentTarget.value = "";
                    }}
                  >
                    <option value="">Change role…</option>
                    {ASSIGNABLE_ROLES.filter((r) => r !== u.role).map((r) => (
                      <option key={r} value={r}>{r === "MEMBER" ? "MEMBER (remove staff access)" : r}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pending && (
          <section className="rounded-md border border-line bg-surface p-4 flex flex-col gap-3">
            <h2 className="font-display text-lg text-ink">
              {pending.user.name ?? "This user"}: {pending.user.role} → {pending.role}
            </h2>

            {STAFF_ROLES.includes(pending.user.role) && !STAFF_ROLES.includes(pending.role) && (
              <p className="text-danger text-sm">
                This removes their staff access
                {pending.user.upcomingShifts > 0
                  ? ` and cancels ${pending.user.upcomingShifts} upcoming shift${pending.user.upcomingShifts === 1 ? "" : "s"}, which reduces bookable capacity straight away.`
                  : "."}{" "}
                Work they have already recorded stays attributed to them.
              </p>
            )}

            <label className="text-ink-muted text-xs flex flex-col gap-1">
              Reason (recorded in the audit log, at least 5 characters)
              <input
                aria-label="Reason for the role change"
                className="rounded-sm border border-line bg-surface px-2 py-1 text-ink"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="hired as workshop technician"
              />
            </label>

            <div className="flex items-center gap-3">
              <Button disabled={busy || reason.trim().length < 5} onClick={commit}>
                {busy ? "Saving…" : "Confirm"}
              </Button>
              <button type="button" className="text-ink-muted text-sm" onClick={() => { setPending(null); setReason(""); }}>
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
