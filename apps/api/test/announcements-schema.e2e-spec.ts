import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = `annschema-${randomUUID().slice(0, 8)}`;

/**
 * Guards the one piece of the announcements schema Prisma cannot express and therefore
 * cannot regenerate: the partial unique index that allows exactly one OPEN thread per
 * (member, vehicle, service type) while leaving closed threads in place as history.
 */
describe("announcements schema", () => {
  const created: string[] = [];

  afterAll(async () => {
    await prisma.announcement.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it("has a partial unique index scoped to ACTIVE threads", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'announcements_open_thread'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("WHERE (status = 'ACTIVE'");
  });

  it("rejects a second OPEN thread for the same (user, vehicle, service type)", async () => {
    const key = { userId: randomUUID(), vehicleId: randomUUID(), serviceTypeId: randomUUID() };
    const first = await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} due`, body: "x" },
    });
    created.push(first.id);

    await expect(
      prisma.announcement.create({
        data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} dup`, body: "x" },
      }),
    ).rejects.toThrow();
  });

  it("allows a new OPEN thread once the previous one is closed — the next service cycle", async () => {
    const key = { userId: randomUUID(), vehicleId: randomUUID(), serviceTypeId: randomUUID() };
    const first = await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} cycle1`, body: "x" },
    });
    created.push(first.id);
    await prisma.announcement.update({ where: { id: first.id }, data: { status: "SUPERSEDED" } });

    // This is the case a TOTAL unique constraint would wrongly block.
    const second = await prisma.announcement.create({
      data: { ...key, kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} cycle2`, body: "x" },
    });
    created.push(second.id);
    expect(second.id).not.toBe(first.id);
  });

  it("lets many broadcasts coexist — their thread key is all-null", async () => {
    const a = await prisma.announcement.create({
      data: { kind: "ADMIN_BROADCAST", status: "ACTIVE", title: `${TAG} b1`, body: "x" },
    });
    const b = await prisma.announcement.create({
      data: { kind: "ADMIN_BROADCAST", status: "ACTIVE", title: `${TAG} b2`, body: "x" },
    });
    created.push(a.id, b.id);
    expect(a.id).not.toBe(b.id);
  });
});
