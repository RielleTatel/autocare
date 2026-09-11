import { MemoryOutboxRepo } from "../../shared/db/memory-outbox.repo";

// `mock`-prefixed so jest's hoisted factories may reference them.
const mockOutbox = new MemoryOutboxRepo();
const mockDeletePhotosFor = jest.fn();
const mockDeleteInspection = jest.fn();
const mockRefreshStatus = jest.fn();

jest.mock("../../shared/sync", () => ({
  // A getter, not a value: `import { discardRejected } from "./discard"` is
  // hoisted above the consts above, so a plain value would be captured while
  // still undefined.
  get outbox() { return mockOutbox; },
  syncProcessor: { refreshStatus: (...a: unknown[]) => mockRefreshStatus(...a) },
}));
jest.mock("../../shared/sync/photos", () => ({
  deletePhotosFor: (...a: unknown[]) => mockDeletePhotosFor(...a),
}));
jest.mock("../../shared/db/inspections.repo", () => ({
  InspectionsRepo: class {
    delete(...a: unknown[]) { return mockDeleteInspection(...a); }
  },
}));

import { discardRejected } from "./discard";

const create = {
  clientUuid: "insp-1",
  entityType: "inspection" as const,
  op: "create" as const,
  payload: { vehicleId: "veh-1" },
};
const submit = {
  clientUuid: "submit-1",
  entityType: "inspection" as const,
  op: "submit" as const,
  payload: { inspectionClientUuid: "insp-1" },
};

const rejected = (clientUuid: string, entityType: "inspection" | "waste_record" = "inspection") =>
  ({ clientUuid, entityType, op: "create", payload: {}, createdAt: 1, attempts: 1, state: "REJECTED" }) as any;

beforeEach(async () => {
  jest.clearAllMocks();
  for (const e of [...(await mockOutbox.rejectedInOrder()), ...(await mockOutbox.pendingInOrder())]) {
    await mockOutbox.discard(e.clientUuid);
  }
});

describe("discardRejected", () => {
  it("removes the rejected create and the submit that depended on it", async () => {
    await mockOutbox.enqueue(create);
    await mockOutbox.enqueue(submit);
    await mockOutbox.markRejected("insp-1", "CHECKLIST_INVALID: unknown checklist version");
    await mockOutbox.markRejected("submit-1", "INSPECTION_INCOMPLETE: inspection to submit was never created");

    await discardRejected(rejected("insp-1"));

    // Both cards clear from one action — the technician should not have to
    // reason about a second failure that only existed because of the first.
    expect(await mockOutbox.counts()).toEqual({ pending: 0, rejected: 0 });
  });

  it("deletes the local inspection rows and queued photos for everything it removed", async () => {
    await mockOutbox.enqueue(create);
    await mockOutbox.enqueue(submit);
    await mockOutbox.markRejected("insp-1", "boom");

    await discardRejected(rejected("insp-1"));

    // Photos belong to a record that will now never sync; uploading them would
    // orphan bytes in the bucket.
    expect(mockDeletePhotosFor.mock.calls.map((c) => c[0]).sort()).toEqual(["insp-1", "submit-1"]);
    expect(mockDeleteInspection.mock.calls.map((c) => c[0]).sort()).toEqual(["insp-1", "submit-1"]);
  });

  it("does not touch inspection storage when discarding another entity type", async () => {
    await mockOutbox.enqueue({ clientUuid: "waste-1", entityType: "waste_record", op: "create", payload: {} });
    await mockOutbox.markRejected("waste-1", "WORK_ORDER_NOT_FOUND");

    await discardRejected(rejected("waste-1", "waste_record"));

    expect(mockDeleteInspection).not.toHaveBeenCalled();
    expect(await mockOutbox.counts()).toEqual({ pending: 0, rejected: 0 });
  });

  it("refreshes the broadcast status so the queue counts follow", async () => {
    await mockOutbox.enqueue(create);
    await mockOutbox.markRejected("insp-1", "boom");

    await discardRejected(rejected("insp-1"));

    // The header count comes from a processor subscription, not from the
    // screen's own state, so it stays stale without this.
    expect(mockRefreshStatus).toHaveBeenCalled();
  });

  it("leaves unrelated queued work alone", async () => {
    await mockOutbox.enqueue(create);
    await mockOutbox.enqueue({ clientUuid: "other", entityType: "inspection", op: "create", payload: { vehicleId: "veh-2" } });
    await mockOutbox.markRejected("insp-1", "boom");

    await discardRejected(rejected("insp-1"));

    expect((await mockOutbox.pendingInOrder()).map((e) => e.clientUuid)).toEqual(["other"]);
  });
});
