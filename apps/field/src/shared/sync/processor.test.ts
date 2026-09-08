import { MemoryOutboxRepo } from "../db/memory-outbox.repo";
import { SyncProcessor, backoffMs } from "./processor";
import type { PhotoUploader, SyncBatchResult, SyncTransport } from "./types";

const item = (n: number) => ({
  clientUuid: `uuid-${n}`,
  entityType: "inspection" as const,
  op: "create" as const,
  payload: { n },
});

function fakeTransport(handler: (items: any[]) => SyncBatchResult[] | Error): SyncTransport & { calls: any[][] } {
  const calls: any[][] = [];
  return {
    calls,
    async syncBatch(items) {
      calls.push(items);
      const out = handler(items);
      if (out instanceof Error) throw out;
      return out;
    },
  };
}

describe("SyncProcessor.drain", () => {
  it("sends pending items strictly in createdAt order and marks APPLIED items synced", async () => {
    const outbox = new MemoryOutboxRepo();
    for (let i = 0; i < 3; i++) await outbox.enqueue(item(i));
    const transport = fakeTransport((items) => items.map((i) => ({ clientUuid: i.clientUuid, status: "APPLIED" as const })));
    const proc = new SyncProcessor({ outbox, transport, now: () => 0 });
    const report = await proc.drain();
    expect(transport.calls[0].map((i) => i.clientUuid)).toEqual(["uuid-0", "uuid-1", "uuid-2"]);
    expect(report).toMatchObject({ sent: 3, applied: 3, duplicates: 0, rejected: 0, failed: 0 });
    expect((await outbox.counts()).pending).toBe(0);
  });

  it("a DUPLICATE response marks synced, not error", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    const transport = fakeTransport((items) => items.map((i) => ({ clientUuid: i.clientUuid, status: "DUPLICATE" as const })));
    const proc = new SyncProcessor({ outbox, transport, now: () => 0 });
    const report = await proc.drain();
    expect(report.duplicates).toBe(1);
    expect(await outbox.counts()).toEqual({ pending: 0, rejected: 0 });
  });

  it("a REJECTED item is parked with the server error and does NOT block later items", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    await outbox.enqueue(item(2));
    const transport = fakeTransport((items) =>
      items.map((i) => i.clientUuid === "uuid-1"
        ? { clientUuid: i.clientUuid, status: "REJECTED" as const, error: { code: "INSPECTION_INCOMPLETE", message: "missing results" } }
        : { clientUuid: i.clientUuid, status: "APPLIED" as const }),
    );
    const proc = new SyncProcessor({ outbox, transport, now: () => 0 });
    const report = await proc.drain();
    expect(report).toMatchObject({ rejected: 1, applied: 1 });
    const rejected = await outbox.rejectedInOrder();
    expect(rejected[0].clientUuid).toBe("uuid-1");
    expect(rejected[0].lastError).toContain("INSPECTION_INCOMPLETE");
    expect(await outbox.counts()).toEqual({ pending: 0, rejected: 1 });
  });

  it("network failure leaves order intact and increments attempts; retry succeeds after backoff", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    await outbox.enqueue(item(2));
    let fail = true;
    const transport = fakeTransport((items) =>
      fail ? new Error("network unreachable") : items.map((i) => ({ clientUuid: i.clientUuid, status: "APPLIED" as const })),
    );
    let now = 0;
    const proc = new SyncProcessor({ outbox, transport, now: () => now });

    const r1 = await proc.drain();
    expect(r1.failed).toBe(2);
    const pending = await outbox.pendingInOrder();
    expect(pending.map((e) => e.clientUuid)).toEqual(["uuid-1", "uuid-2"]);
    expect(pending[0].attempts).toBe(1);

    // Within the 30s backoff window nothing is sent
    now = 10_000;
    const r2 = await proc.drain();
    expect(r2.sent).toBe(0);
    expect(r2.deferred).toBe(2);

    // After backoff elapses, the retry drains successfully
    fail = false;
    now = 31_000;
    const r3 = await proc.drain();
    expect(r3.applied).toBe(2);
    expect((await outbox.counts()).pending).toBe(0);
  });

  it("backoff is exponential 30s·2ⁿ capped at 15 min", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(3)).toBe(120_000);
    expect(backoffMs(10)).toBe(900_000);
  });

  it("photos upload only after their owner record's APPLIED/DUPLICATE receipt", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    await outbox.enqueue(item(2));
    const uploaded: string[] = [];
    const photos: PhotoUploader = {
      async uploadFor(owner) { uploaded.push(owner); return { uploaded: 1, failed: 0 }; },
      async pendingCount() { return 0; },
    };
    const transport = fakeTransport((items) =>
      items.map((i) => i.clientUuid === "uuid-1"
        ? { clientUuid: i.clientUuid, status: "APPLIED" as const }
        : { clientUuid: i.clientUuid, status: "REJECTED" as const, error: { code: "X", message: "no" } }),
    );
    const proc = new SyncProcessor({ outbox, transport, photos, now: () => 0 });
    const report = await proc.drain();
    expect(uploaded).toEqual(["uuid-1"]); // never for the rejected uuid-2
    expect(report.photosUploaded).toBe(1);
  });

  it("drain is re-entrant-safe: a second call while running is a no-op", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    let release!: (v: SyncBatchResult[]) => void;
    const gate = new Promise<SyncBatchResult[]>((res) => { release = res; });
    const transport: SyncTransport = { syncBatch: () => gate };
    const proc = new SyncProcessor({ outbox, transport, now: () => 0 });

    const first = proc.drain();
    const second = await proc.drain();
    expect(second.alreadyDraining).toBe(true);
    expect(second.sent).toBe(0);
    release([{ clientUuid: "uuid-1", status: "APPLIED" }]);
    const r1 = await first;
    expect(r1.applied).toBe(1);
  });

  it("notifies subscribers with a status snapshot after drain", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    const transport = fakeTransport((items) => items.map((i) => ({ clientUuid: i.clientUuid, status: "APPLIED" as const })));
    const proc = new SyncProcessor({ outbox, transport, now: () => 42_000 });
    const snapshots: any[] = [];
    proc.subscribe((s) => snapshots.push(s));
    await proc.drain();
    const last = snapshots[snapshots.length - 1];
    expect(last).toMatchObject({ pendingCount: 0, isDraining: false, lastSyncAt: 42_000 });
  });

  it("surfaces a transport failure in the status snapshot instead of failing silently", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    const transport = fakeTransport(() => new Error("Missing bearer token"));
    const proc = new SyncProcessor({ outbox, transport, now: () => 0 });
    await proc.drain();
    expect((await proc.snapshot()).lastError).toBe("Missing bearer token");
  });

  it("clears a recorded transport failure once a later drain succeeds", async () => {
    const outbox = new MemoryOutboxRepo();
    await outbox.enqueue(item(1));
    let fail = true;
    let clock = 0;
    const transport = fakeTransport((items) =>
      fail ? new Error("Network request failed") : items.map((i) => ({ clientUuid: i.clientUuid, status: "APPLIED" as const })),
    );
    const proc = new SyncProcessor({ outbox, transport, now: () => clock });
    await proc.drain();
    expect((await proc.snapshot()).lastError).toBe("Network request failed");
    fail = false;
    clock = backoffMs(1); // past the first retry's backoff window, so it is eligible again
    await proc.drain();
    expect((await proc.snapshot()).lastError).toBeNull();
  });
});
