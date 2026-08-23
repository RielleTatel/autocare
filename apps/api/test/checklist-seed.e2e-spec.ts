import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { computeVHS, seedConfig } from "@autocare/scoring";
import { seedChecklist } from "../prisma/seed-checklist";
import { toChecklistConfig } from "../src/modules/checklists/config-mapper";

// The seeded checklist v1.0 is durable shared data (the launch checklist), not
// test fixtures — this spec never deletes it, and relies on seedChecklist being
// idempotent so repeated runs leave row counts unchanged.
describe("checklist v1.0 seed (e2e)", () => {
  const prisma = new PrismaClient();
  let versionId: string;

  beforeAll(async () => {
    versionId = await seedChecklist(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const load = () =>
    prisma.checklistVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: { categories: { include: { points: true } } },
    });

  it("is idempotent — re-seeding creates no new rows", async () => {
    const again = await seedChecklist(prisma);
    expect(again).toBe(versionId);
    expect(await prisma.checklistVersion.count({ where: { versionLabel: "v1.0" } })).toBe(1);
  });

  it("has 10 categories and 50 points, active and published", async () => {
    const v = await load();
    expect(v.isActive).toBe(true);
    expect(v.status).toBe("PUBLISHED");
    expect(v.weightVersion).toBe("w1.0");
    expect(v.categories).toHaveLength(10);
    expect(v.categories.reduce((n, c) => n + c.points.length, 0)).toBe(50);
  });

  it("category weights sum to exactly 100 and per-category point weights sum to 100", async () => {
    const v = await load();
    expect(v.categories.reduce((s, c) => s + c.weight, 0)).toBe(100);
    for (const c of v.categories) {
      expect(c.points.reduce((s, p) => s + p.weightInCategory, 0)).toBe(100);
    }
  });

  it("every MEASURED point has full thresholds + unit; every point has EN+FIL labels, recommendation and templates", async () => {
    const v = await load();
    for (const c of v.categories) {
      for (const p of c.points) {
        if (p.inputType === "MEASURED") {
          expect(p.thresholdDirection).not.toBeNull();
          expect(p.thresholdGood).not.toBeNull();
          expect(p.thresholdMonitor).not.toBeNull();
          expect(p.thresholdAttention).not.toBeNull();
          expect(p.unit).not.toBeNull();
        }
        expect(p.label.length).toBeGreaterThan(0);
        expect(p.labelFil ?? "").not.toBe("");
        expect(p.recommendation.length).toBeGreaterThan(0);
        const templates = p.templates as Record<string, string> | null;
        expect(templates).not.toBeNull();
        for (const status of ["GOOD", "MONITOR", "ATTENTION", "CRITICAL"]) {
          expect(typeof templates![status]).toBe("string");
        }
      }
    }
  });

  it("DB-loaded config scores fixtures identically to the authored seedConfig (round-trip fidelity, NFR-055)", async () => {
    const dbConfig = toChecklistConfig(await load());
    for (const name of ["02-all-good.json", "29-mixed-real-world.json", "30-worst-of-safety-overrides.json"]) {
      const fx = JSON.parse(readFileSync(join(__dirname, "../../../packages/scoring/fixtures", name), "utf8"));
      const input = { results: fx.results, daysSinceInspection: fx.daysSinceInspection };
      expect(computeVHS(input, dbConfig)).toEqual(computeVHS(input, seedConfig));
    }
  });
});
