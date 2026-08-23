import { PrismaClient } from "@prisma/client";
import { seedParts } from "../prisma/seed-parts";

// The seeded parts catalogue is durable shared data (the launch catalogue), not
// test fixtures — this spec never deletes it and relies on seedParts being
// idempotent so repeated runs leave row counts unchanged.
describe("parts catalogue seed (e2e)", () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await seedParts(prisma);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds at least 40 parts, idempotently", async () => {
    const before = await prisma.part.count();
    expect(before).toBeGreaterThanOrEqual(40);
    await seedParts(prisma);
    expect(await prisma.part.count()).toBe(before);
  });

  it("every part has positive prices and a category; price ≥ cost (margin sanity)", async () => {
    const parts = await prisma.part.findMany();
    for (const p of parts) {
      expect(p.category.length).toBeGreaterThan(0);
      expect(Number(p.costCentavos)).toBeGreaterThan(0);
      expect(Number(p.priceCentavos)).toBeGreaterThanOrEqual(Number(p.costCentavos));
    }
  });

  it("front brake pads exist for the worked-example quote", async () => {
    const pad = await prisma.part.findUnique({ where: { sku: "BRK-PAD-FR-STD" } });
    expect(pad).not.toBeNull();
    expect(Number(pad!.priceCentavos)).toBe(155000);
  });
});
