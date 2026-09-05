"use client";

import { useCallback, useEffect, useState } from "react";
import { getBroadcasts, createBroadcast, unpublishBroadcast, type Broadcast } from "../../../lib/announcements/api";
import { Button } from "../../../components/Button";

/**
 * A-16 — FR-107 broadcast console. Under /admin because the middleware gates that prefix to
 * ADMIN alone, matching the API, which rejects a non-admin poster with 403.
 *
 * Audience is every member for v1; segmentation is deferred (design spec §12), so there is
 * deliberately no audience picker yet rather than one that only offers "everyone".
 */
export default function AnnouncementsAdminPage() {
  const [rows, setRows] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await getBroadcasts());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load announcements");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      setErr("Title and message are both required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createBroadcast({ title: title.trim(), body: body.trim() });
      // Only clear once the write succeeded — a failed publish must not lose the draft.
      setTitle("");
      setBody("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (id: string) => {
    setErr(null);
    try {
      await unpublishBroadcast(id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to unpublish");
    }
  };

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Announcements</h1>
        <p className="text-sm text-ink-muted">Published to every member&apos;s announcements feed.</p>
      </header>

      {err && (
        <p role="alert" className="text-danger text-sm">
          {err}
        </p>
      )}

      <section className="space-y-3 max-w-xl">
        <div className="space-y-1">
          <label className="block text-sm text-ink-muted" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            aria-label="Title"
            className="w-full border border-line rounded px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm text-ink-muted" htmlFor="body">
            Message
          </label>
          <textarea
            id="body"
            aria-label="Message"
            rows={4}
            className="w-full border border-line rounded px-3 py-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <Button onClick={publish} disabled={busy}>
          Publish to all members
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-ink">Published</h2>
        {rows.length === 0 && <p className="text-sm text-ink-muted">No announcements yet.</p>}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="border border-line rounded p-3 flex justify-between items-start gap-4">
              <div className="space-y-1">
                <p className="font-medium text-ink">{r.title}</p>
                <p className="text-sm text-ink-muted">{r.body}</p>
                <p className="text-xs text-ink-muted">
                  {new Date(r.publishedAt).toLocaleString()} · {r.status}
                </p>
              </div>
              {r.status === "ACTIVE" && (
                <Button variant="secondary" onClick={() => unpublish(r.id)}>
                  Unpublish
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
