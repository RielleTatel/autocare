/** Execute the actual repository SQL on disk using Node's SQLite driver. This
 * proves schema/transaction/reopen behavior; Expo native-driver validation is separate. */
const mockDir = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "field-durable-"));
jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_: string, value: string) => require("node:crypto").createHash("sha256").update(value).digest("hex"),
}));
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async (name: string) => {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(require("node:path").join(mockDir, name));
    return {
      execAsync: async (sql: string) => db.exec(sql),
      runAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).run(...args),
      getFirstAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) ?? null,
      getAllAsync: async (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args),
      withTransactionAsync: async (cb: () => Promise<void>) => { db.exec("BEGIN"); try { await cb(); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } },
    };
  },
}));
import { getDb, setStorageContext } from "./schema";
import { InspectionsRepo } from "./inspections.repo";
import { SqliteOutboxRepo } from "./outbox.repo";
import { InspectionDraft, type CachedChecklist } from "../../features/inspection/draft";
const checklist: CachedChecklist = { id: "v1", versionLabel: "v1", weightVersion: "w1", categories: [{ code: "BRAKES", label: "Brakes", weight: 100, points: [{ code: "PAD", label: "Pads", weightInCategory: 100, inputType: "STATUS", isSafetyCritical: true, recommendation: "Fix" }] }] };
let n = 0;
const deps = () => ({ inspections: new InspectionsRepo(), outbox: new SqliteOutboxRepo(), uuid: () => `uuid-${++n}`, now: () => Date.now() });
it("restores the booking snapshot, odometer, answers, notes and photos after repository reopen", async () => {
  setStorageContext("api-a", "staff-a");
  const d = await InspectionDraft.start(deps(), { vehicleId: "v1", appointmentId: "booking1", odometerKm: 42, checklist });
  await d.saveResult({ pointCode: "PAD", status: "GOOD", notes: "saved note", photoUris: ["file://photo.jpg"] });
  const resumed = await InspectionDraft.start(deps(), { vehicleId: "v1", appointmentId: "booking1", odometerKm: 999, checklist: { ...checklist, id: "changed" } });
  expect(resumed.clientUuid).toBe(d.clientUuid); expect(resumed.checklist.id).toBe("v1"); expect(resumed.odometerKm).toBe(42);
  expect(await resumed.results()).toEqual([{ pointCode: "PAD", status: "GOOD", notes: "saved note", photoUris: ["file://photo.jpg"], measuredValue: undefined }]);
  expect(await new InspectionsRepo().listDrafts()).toHaveLength(1);
});
it("isolates drafts and outbox by staff and API, and restores them only for the original context", async () => {
  setStorageContext("api-a", "staff-a");
  const saved = await new InspectionsRepo().findByBooking("booking1");
  setStorageContext("api-a", "staff-b");
  expect(await new InspectionsRepo().findByBooking("booking1")).toBeNull();
  expect(await new SqliteOutboxRepo().pendingInOrder()).toEqual([]);
  setStorageContext("api-b", "staff-a");
  expect(await new InspectionsRepo().findByBooking("booking1")).toBeNull();
  setStorageContext("api-a", "staff-a");
  expect((await new InspectionsRepo().findByBooking("booking1"))?.clientUuid).toBe(saved?.clientUuid);
});
it("rolls back half a submission, then locks and queues one create/submit pair on retry", async () => {
  setStorageContext("api-a", "staff-a");
  const d = await InspectionDraft.start(deps(), { vehicleId: "v1", appointmentId: "booking1", checklist });
  const db = await getDb();
  await db.execAsync("CREATE TRIGGER fail_submit BEFORE INSERT ON outbox WHEN NEW.op = 'submit' BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END;");
  await expect(d.submit()).rejects.toThrow("simulated disk failure");
  expect(await new SqliteOutboxRepo().pendingInOrder()).toHaveLength(0);
  expect((await new InspectionsRepo().get(d.clientUuid))?.status).toBe("DRAFT");
  await db.execAsync("DROP TRIGGER fail_submit;");
  await Promise.all([d.submit(), d.submit()]);
  expect((await new SqliteOutboxRepo().pendingInOrder()).map((r) => r.op)).toEqual(["create", "submit"]);
  const reopened = await InspectionDraft.start(deps(), { vehicleId: "v1", appointmentId: "booking1", checklist });
  expect(reopened.isLocked).toBe(true);
  await expect(reopened.submit()).rejects.toThrow(/locked/);
});
it("retries the persisted rejected group unchanged without replaying its synced create", async () => {
  setStorageContext("api-a", "staff-a");
  const outbox = new SqliteOutboxRepo();
  const pair = await outbox.pendingInOrder();
  await outbox.markSynced(pair[0].clientUuid);
  await outbox.markRejected(pair[1].clientUuid, "temporary denial");
  await outbox.recordAttempt(pair[1].clientUuid, Date.now(), "offline");
  await outbox.retry(pair[0].clientUuid);
  const pending = await outbox.pendingInOrder();
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ clientUuid: pair[1].clientUuid, payload: pair[1].payload, attempts: 0, state: "PENDING" });
  expect(await outbox.rejectedInOrder()).toEqual([]);
});
