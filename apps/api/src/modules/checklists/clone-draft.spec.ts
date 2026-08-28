import { ChecklistsService } from "./checklists.service";

/**
 * Cloning the active checklist into a draft used to issue one `create` per row:
 * 1 version + 10 categories + 50 points = 61 sequential round trips inside a
 * single interactive transaction. Against the hosted database (~121ms per round
 * trip) that ran ~7.4s, past Prisma's 5s interactive-transaction limit, so the
 * transaction expired with P2028 and the endpoint returned 500. It only ever
 * worked because the database used to be local, where 61 round trips cost ~60ms.
 *
 * The clone must therefore be bulk — a bounded number of statements that does
 * not grow with checklist size.
 */

const admin = { id: "u-admin", role: "ADMIN" } as never;

function activeChecklist() {
  const points = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({
      code: `${prefix}-${i}`, label: `Point ${i}`, labelFil: null, weightInCategory: 100 / n,
      isSafetyCritical: false, inputType: "STATUS", unit: null,
      thresholdDirection: null, thresholdGood: null, thresholdMonitor: null, thresholdAttention: null,
      recommendation: "do the thing", templates: null, requiresPhotoOnAdverse: false,
      notApplicableWhen: null, sortOrder: i,
    }));
  return {
    id: "v-active", versionLabel: "v1.0", weightVersion: "w1.0", status: "PUBLISHED", isActive: true,
    publishedAt: new Date(),
    categories: Array.from({ length: 10 }, (_, c) => ({
      id: `c-${c}`, code: `CAT${c}`, label: `Category ${c}`, labelFil: null,
      weight: 10, sortOrder: c, points: points(5, `CAT${c}`),
    })),
  };
}

/** Counts every statement the clone issues inside the transaction. */
function makePrisma(calls: string[]) {
  const active = activeChecklist();
  const tx = {
    checklistVersion: {
      create: async () => { calls.push("checklistVersion.create"); return { id: "v-draft", versionLabel: "v1.1" }; },
    },
    checklistCategory: {
      create: async () => { calls.push("checklistCategory.create"); return { id: "c-new" }; },
      createMany: async () => { calls.push("checklistCategory.createMany"); return { count: 10 }; },
    },
    checklistPoint: {
      create: async () => { calls.push("checklistPoint.create"); return { id: "p-new" }; },
      createMany: async () => { calls.push("checklistPoint.createMany"); return { count: 50 }; },
    },
  };
  return {
    checklistVersion: {
      findFirst: async () => active,
      findUniqueOrThrow: async () => active,
      findMany: async () => [active],
      // nextVersionLabel probes for a label clash; no clash in this fixture.
      findUnique: async () => null,
    },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as never;
}

const audit = { record: async () => undefined } as never;

describe("ChecklistsService.createDraft", () => {
  it("clones with a bounded number of statements, not one per row", async () => {
    const calls: string[] = [];
    await new ChecklistsService(makePrisma(calls), audit).createDraft(admin);

    // 1 version + 1 bulk categories + 1 bulk points. The old shape was 61.
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it("inserts categories and points in bulk", async () => {
    const calls: string[] = [];
    await new ChecklistsService(makePrisma(calls), audit).createDraft(admin);

    expect(calls).toContain("checklistCategory.createMany");
    expect(calls).toContain("checklistPoint.createMany");
  });

  it("issues no per-row create — that is what blew the transaction budget", async () => {
    const calls: string[] = [];
    await new ChecklistsService(makePrisma(calls), audit).createDraft(admin);

    expect(calls).not.toContain("checklistCategory.create");
    expect(calls).not.toContain("checklistPoint.create");
  });

  it("does not grow its statement count with checklist size", async () => {
    const calls: string[] = [];
    await new ChecklistsService(makePrisma(calls), audit).createDraft(admin);
    // 60 rows cloned; statements must stay flat.
    expect(calls.length).toBeLessThan(10);
  });
});
