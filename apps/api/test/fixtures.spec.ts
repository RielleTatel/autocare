import { purgeFixtures, type FixtureKeys } from "./fixtures";

/**
 * The e2e specs share one hosted database. Each cleans up in afterAll — but
 * afterAll never runs when beforeAll throws, so a single aborted run left
 * fixtures behind and every later run failed on
 * "Unique constraint failed on the fields: (firebase_uid)". Eight orphaned
 * users, the oldest five days stale, were found this way.
 *
 * purgeFixtures makes setup idempotent: a spec clears its own well-known keys
 * before creating them, so an aborted run can no longer poison the next.
 */

/** Records every deleteMany call so we can assert ordering without a database. */
function recordingPrisma(log: string[]) {
  const model = (name: string) => ({
    deleteMany: async (args: unknown) => {
      log.push(name);
      void args;
      return { count: 0 };
    },
  });
  // purgeFixtures resolves user ids before deleting cash shifts, because
  // CashShift declares no `user` relation to filter through.
  const user = { ...model("user"), findMany: async () => [{ id: "u-1" }] };
  return {
    payment: model("payment"),
    invoiceItem: model("invoiceItem"),
    invoice: model("invoice"),
    entitlementUsage: model("entitlementUsage"),
    subscription: model("subscription"),
    workOrderItem: model("workOrderItem"),
    workOrder: model("workOrder"),
    categoryScore: model("categoryScore"),
    healthScore: model("healthScore"),
    inspectionResult: model("inspectionResult"),
    inspection: model("inspection"),
    certificate: model("certificate"),
    recommendation: model("recommendation"),
    announcement: model("announcement"),
    appointment: model("appointment"),
    odometerReading: model("odometerReading"),
    vehicle: model("vehicle"),
    cashShift: model("cashShift"),
    staffShift: model("staffShift"),
    consentRecord: model("consentRecord"),
    dataRequest: model("dataRequest"),
    user,
    planEntitlement: model("planEntitlement"),
    plan: model("plan"),
  };
}

const run = async (keys: FixtureKeys) => {
  const log: string[] = [];
  await purgeFixtures(recordingPrisma(log) as never, keys);
  return log;
};

describe("purgeFixtures", () => {
  it("does nothing when given no keys — never a blanket delete", async () => {
    expect(await run({})).toEqual([]);
  });

  it("deletes a user's dependents before the user itself", async () => {
    const log = await run({ firebaseUids: ["cash-member"] });
    expect(log).toContain("user");
    expect(log.indexOf("consentRecord")).toBeLessThan(log.indexOf("user"));
    expect(log.indexOf("subscription")).toBeLessThan(log.indexOf("user"));
  });

  it("deletes vehicles before their owner, so no vehicle is stranded ownerless", async () => {
    // The optional ownerUserId FK is SET NULL on user deletion, which would
    // leave a vehicle violating vehicles_single_owner_check.
    const log = await run({ firebaseUids: ["sub-owner-a"] });
    expect(log.indexOf("vehicle")).toBeLessThan(log.indexOf("user"));
  });

  it("deletes a vehicle's dependents before the vehicle", async () => {
    const log = await run({ plateNos: ["SUB0004"] });
    for (const dependent of ["workOrder", "inspection", "appointment", "healthScore"]) {
      expect(log.indexOf(dependent)).toBeLessThan(log.indexOf("vehicle"));
    }
  });

  it("deletes plan entitlements before the plan", async () => {
    const log = await run({ planCodes: ["E2E-CASH-BASIC"] });
    expect(log.indexOf("planEntitlement")).toBeLessThan(log.indexOf("plan"));
  });

  it("touches only the tables a given key set implies", async () => {
    expect(await run({ planCodes: ["E2E-CASH-BASIC"] })).toEqual(["planEntitlement", "plan"]);
  });
});
