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
