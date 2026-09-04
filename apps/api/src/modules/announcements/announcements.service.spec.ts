import { AnnouncementsService } from "./announcements.service";

/**
 * In-memory stand-in for the two tables this service touches. It matches open threads on
 * (userId, vehicleId, serviceTypeId, status) and deliberately NOT on `kind` — the same columns
 * the partial unique index covers. Filtering by kind would break thread updating, because a
 * thread changes kind as it transitions (SERVICE_DUE -> APPOINTMENT_BOOKED).
 */
function makePrisma() {
  const rows: any[] = [];
  const reads: any[] = [];
  return {
    rows,
    reads,
    announcement: {
      findFirst: jest.fn(async ({ where }: any) =>
        rows.find(
          (r) =>
            r.userId === where.userId &&
            r.vehicleId === where.vehicleId &&
            r.serviceTypeId === where.serviceTypeId &&
            r.status === where.status,
        ) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `a${rows.length + 1}`, publishedAt: new Date("2026-09-01T00:00:00Z"), ...data };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      findMany: jest.fn(async () => rows),
    },
    announcementRead: {
      createMany: jest.fn(async ({ data }: any) => {
        reads.push(...(Array.isArray(data) ? data : [data]));
        return { count: 1 };
      }),
      findMany: jest.fn(async () => reads),
    },
    serviceType: {
      findMany: jest.fn(async () => [{ id: "s1", name: "Oil Change" }]),
    },
  } as any;
}

describe("AnnouncementsService.applyThreadEvent", () => {
  const base = { userId: "u1", vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change" };

  it("creates a thread on first due detection", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]).toMatchObject({ kind: "SERVICE_DUE", status: "ACTIVE", title: "Oil Change due" });
  });

  it("is idempotent — a second detection creates nothing", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.announcement.create).toHaveBeenCalledTimes(1);
  });

  it("updates the existing thread in place when booked", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME" });
    await svc.applyThreadEvent({
      ...base,
      event: { type: "APPOINTMENT_BOOKED" },
      appointmentId: "ap1",
      scheduledStart: new Date("2026-09-12T02:00:00Z"),
    });
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0]).toMatchObject({ kind: "APPOINTMENT_BOOKED", appointmentId: "ap1", title: "Oil Change scheduled" });
  });

  it("does nothing when an event arrives with no open thread", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "APPOINTMENT_BOOKED" }, appointmentId: "ap1" });
    expect(prisma.rows).toHaveLength(0);
  });

  it("keeps the original due reason when a later event does not carry one", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({ ...base, event: { type: "SERVICE_DUE_DETECTED" }, reason: "ODOMETER" });
    await svc.applyThreadEvent({ ...base, event: { type: "APPOINTMENT_BOOKED" }, appointmentId: "ap1" });
    await svc.applyThreadEvent({ ...base, event: { type: "APPOINTMENT_CANCELLED" } });
    // Back to due, and the odometer wording must survive the round trip.
    expect(prisma.rows[0]).toMatchObject({ kind: "SERVICE_DUE", reason: "ODOMETER" });
    expect(prisma.rows[0].body).toContain("mileage");
  });
});

describe("AnnouncementsService.feed", () => {
  it("reports unread count and marks a row read for this viewer only", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({
      userId: "u1", vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change",
      event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME",
    });

    const before = await svc.feed("u1", new Map());
    expect(before.unreadCount).toBe(1);
    expect(before.items[0].read).toBe(false);

    await svc.markRead("u1", before.items[0].id);
    const after = await svc.feed("u1", new Map());
    expect(after.unreadCount).toBe(0);
    expect(after.items[0].read).toBe(true);
  });

  it("attaches a plate only when the caller supplies one", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({
      userId: "u1", vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change",
      event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME",
    });

    expect((await svc.feed("u1", new Map())).items[0].plate).toBeUndefined();
    expect((await svc.feed("u1", new Map([["v1", "ABA1234"]]))).items[0].plate).toBe("ABA1234");
  });
});

describe("AnnouncementsService.activeServiceDue", () => {
  it("returns open service-due threads with their service name resolved", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    await svc.applyThreadEvent({
      userId: "u1", vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change",
      event: { type: "SERVICE_DUE_DETECTED" }, reason: "TIME",
    });

    const due = await svc.activeServiceDue(["v1"]);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ vehicleId: "v1", serviceTypeId: "s1", serviceTypeName: "Oil Change" });
  });

  it("returns nothing for no vehicles without querying", async () => {
    const prisma = makePrisma();
    const svc = new AnnouncementsService(prisma);
    expect(await svc.activeServiceDue([])).toEqual([]);
    expect(prisma.announcement.findMany).not.toHaveBeenCalled();
  });
});
