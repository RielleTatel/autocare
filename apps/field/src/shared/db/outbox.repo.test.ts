import { MemoryOutboxRepo } from "./memory-outbox.repo";

const item = (n: number) => ({
  clientUuid: `uuid-${n}`,
  entityType: "inspection" as const,
  op: "create" as const,
  payload: { n },
});

describe("outbox repo semantics", () => {
  it("drains strictly in enqueue order, even for same-millisecond enqueues", async () => {
    const repo = new MemoryOutboxRepo();
    for (let i = 0; i < 5; i++) await repo.enqueue(item(i));
    const pending = await repo.pendingInOrder();
    expect(pending.map((e) => e.clientUuid)).toEqual(["uuid-0", "uuid-1", "uuid-2", "uuid-3", "uuid-4"]);
  });

  it("markSynced removes the entry from pending", async () => {
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue(item(2));
    await repo.markSynced("uuid-1");
    expect((await repo.pendingInOrder()).map((e) => e.clientUuid)).toEqual(["uuid-2"]);
    expect(await repo.counts()).toEqual({ pending: 1, rejected: 0 });
  });

  it("markRejected parks the entry with its server error and keeps later items pending", async () => {
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue(item(2));
    await repo.markRejected("uuid-1", "INSPECTION_INCOMPLETE: missing results");
    expect((await repo.pendingInOrder()).map((e) => e.clientUuid)).toEqual(["uuid-2"]);
    const rejected = await repo.rejectedInOrder();
    expect(rejected).toHaveLength(1);
    expect(rejected[0].lastError).toContain("INSPECTION_INCOMPLETE");
  });

  it("discard removes the entry and returns what it removed", async () => {
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue(item(2));
    await repo.markRejected("uuid-1", "CHECKLIST_INVALID: unknown checklist version");

    expect(await repo.discard("uuid-1")).toEqual(["uuid-1"]);
    expect(await repo.rejectedInOrder()).toEqual([]);
    expect(await repo.counts()).toEqual({ pending: 1, rejected: 0 });
  });

  it("discard cascades to a submit that depends on the discarded create", async () => {
    // Mirrors what InspectionDraft.submit() enqueues: a create, then a submit
    // that references it only through payload.inspectionClientUuid. Once the
    // create is gone the submit can never apply, so it must go too — otherwise
    // the technician is left staring at a second unclearable card.
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue({
      clientUuid: "uuid-submit",
      entityType: "inspection",
      op: "submit",
      payload: { inspectionClientUuid: "uuid-1" },
    });
    await repo.markRejected("uuid-1", "CHECKLIST_INVALID: unknown checklist version");
    await repo.markRejected("uuid-submit", "INSPECTION_INCOMPLETE: inspection to submit was never created");

    expect((await repo.discard("uuid-1")).sort()).toEqual(["uuid-1", "uuid-submit"]);
    expect(await repo.counts()).toEqual({ pending: 0, rejected: 0 });
  });

  it("discard leaves unrelated entries alone", async () => {
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue({
      clientUuid: "uuid-other-submit",
      entityType: "inspection",
      op: "submit",
      payload: { inspectionClientUuid: "some-other-inspection" },
    });

    expect(await repo.discard("uuid-1")).toEqual(["uuid-1"]);
    expect((await repo.pendingInOrder()).map((e) => e.clientUuid)).toEqual(["uuid-other-submit"]);
  });

  it("recordAttempt increments attempts and keeps the entry pending, order intact", async () => {
    const repo = new MemoryOutboxRepo();
    await repo.enqueue(item(1));
    await repo.enqueue(item(2));
    await repo.recordAttempt("uuid-1", 1000, "network unreachable");
    const pending = await repo.pendingInOrder();
    expect(pending.map((e) => e.clientUuid)).toEqual(["uuid-1", "uuid-2"]);
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastAttemptAt).toBe(1000);
  });
});
