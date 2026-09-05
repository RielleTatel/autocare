import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RedisService } from "../src/common/redis/redis.service";
import { RemindersService } from "../src/modules/scheduling/reminders.service";
import { AppointmentsService } from "../src/modules/scheduling/appointments.service";

const TAG = `annj-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";
const DATE = "2027-08-02"; // far-future dateOverride, distinct from other suites
const DAY = 86_400_000;

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

/**
 * End-to-end journey for the announcements feature: the daily reminder job opens a thread, the
 * member books through the real HTTP booking flow (slots -> hold -> appointment), the T-24h job
 * reminds, cancelling returns the thread to due, and an admin broadcast reaches the same feed.
 *
 * Everything runs against the real app: real Postgres, real Redis holds, real capacity engine.
 * The point is to catch integration defects the per-module specs cannot see.
 */
describe("announcements journey (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let redis: RedisService;
  let reminders: RemindersService;
  let appointments: AppointmentsService;

  let memberId: string;
  let memberToken: string;
  let adminToken: string;
  let vehicleId: string;
  let serviceTypeId: string;
  let bayId: string;
  const mechId = randomUUID();

  const asMember = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  /** The stagger spreads vehicles over 28 days, so sweep the whole cycle to guarantee a send. */
  const runReminderCycle = async (from: Date) => {
    let created = 0;
    for (let d = 0; d < 28; d++) {
      created += (await reminders.serviceDue(new Date(from.getTime() + d * DAY))).created;
    }
    return created;
  };

  const myThreads = async () => {
    const res = await asMember().get("/api/v1/me/announcements").expect(200);
    return res.body.data.items.filter((i: any) => i.vehicleId === vehicleId || i.title.includes(TAG));
  };

  const myAttention = async () => {
    const res = await asMember().get("/api/v1/me/attention").expect(200);
    return res.body.data as any[];
  };

  /**
   * Attention items for THIS suite's service only. The journey vehicle is 300 days old, so the
   * globally-seeded catalogue (Tire Rotation, Full Inspection, ...) is legitimately due on it
   * as well — asserting on "any SERVICE_DUE for this vehicle" would both pass for the wrong
   * reason and fail for a correct one.
   */
  const attentionForOurService = async () =>
    (await myAttention()).find(
      (i) => i.kind === "SERVICE_DUE" && i.vehicleId === vehicleId && i.deepLink?.params?.serviceTypeId === serviceTypeId,
    );

  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    reminders = app.get(RemindersService);
    appointments = app.get(AppointmentsService);

    const member = await prisma.user.create({
      data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    });
    const admin = await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, role: "ADMIN" } });
    await prisma.user.create({ data: { id: mechId, firebaseUid: `${TAG}-mech`, role: "MECHANIC" } });
    memberId = member.id;
    memberToken = await seal(member.id, "MEMBER");
    adminToken = await seal(admin.id, "ADMIN");

    const st = await prisma.serviceType.create({
      data: {
        code: `${TAG}-OIL`, name: `${TAG} Oil Change`, standardDurationMin: 60,
        requiredSkills: ["OIL"], priceCentavos: 85000n, intervalDays: 180, intervalKm: 5000,
      },
    });
    serviceTypeId = st.id;
    bayId = (await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } })).id;
    await prisma.operatingHours.create({ data: { dateOverride: DATE, openTime: "09:00", closeTime: "17:00", walkInBufferPct: 0 } });
    await prisma.staffShift.create({ data: { userId: mechId, date: DATE, startTime: "09:00", endTime: "17:00", skills: ["OIL"] } });

    // Registered 300 days ago and never serviced -> overdue by TIME against the 180-day interval.
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          ownerUserId: memberId, plateNo: `AJ${randomUUID().slice(0, 5).toUpperCase()}`,
          make: "Toyota", model: "Vios", year: 2020, fuelType: "GASOLINE", transmission: "AT",
          currentOdometerKm: 1000, createdAt: new Date(Date.now() - 300 * DAY),
        },
      })
    ).id;
  });

  afterAll(async () => {
    try {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await redis.client.scan(cursor, "MATCH", `hold:${bayId}:*`, "COUNT", 200);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== "0");
      if (keys.length) await redis.client.del(...keys);

      const anns = await prisma.announcement.findMany({
        where: { OR: [{ vehicleId }, { userId: memberId }, { title: { contains: TAG } }] },
        select: { id: true },
      });
      await prisma.announcementRead.deleteMany({ where: { announcementId: { in: anns.map((a) => a.id) } } });
      await prisma.announcement.deleteMany({ where: { id: { in: anns.map((a) => a.id) } } });
      await prisma.appointment.deleteMany({ where: { vehicleId } });
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.operatingHours.deleteMany({ where: { dateOverride: DATE } });
      await prisma.serviceBay.deleteMany({ where: { id: bayId } });
      await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const bookOverHttp = async (): Promise<string> => {
    const slotsRes = await asMember()
      .get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`)
      .expect(200);
    const slot = slotsRes.body.data[0];
    expect(slot).toBeDefined();

    const holdRes = await asMember()
      .post("/api/v1/scheduling/holds")
      .send({ bayId: slot.bayId, start: slot.start, serviceTypeId })
      .expect(201);

    const res = await asMember()
      .post("/api/v1/appointments")
      .send({ holdId: holdRes.body.data.holdId, vehicleId, serviceTypeId, requiresPickup: false })
      .expect(201);
    return res.body.data.id;
  };

  it("1. the daily job opens a SERVICE_DUE thread the member can read", async () => {
    const created = await runReminderCycle(new Date());
    expect(created).toBeGreaterThanOrEqual(1);

    const threads = await myThreads();
    const due = threads.find((t: any) => t.serviceTypeId === serviceTypeId);
    expect(due).toBeDefined();
    expect(due.kind).toBe("SERVICE_DUE");
    expect(due.read).toBe(false);
    expect(due.title).toContain("due");
  });

  it("2. the same due service also surfaces on the attention dashboard", async () => {
    const svc = await attentionForOurService();
    expect(svc).toBeDefined();
    expect(svc.deepLink).toEqual({ screen: "Booking", params: { vehicleId, serviceTypeId } });
  });

  it("3. re-running the daily job creates no duplicate thread", async () => {
    await runReminderCycle(new Date());
    const due = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId);
    expect(due).toHaveLength(1);
  });

  it("4. booking transitions the SAME thread to scheduled — no second notification", async () => {
    await bookOverHttp();

    const mine = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId);
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe("APPOINTMENT_BOOKED");
    expect(mine[0].title).toContain("scheduled");
    expect(mine[0].appointmentId).toBeTruthy();
  });

  it("5. a booked service no longer nags on the attention dashboard", async () => {
    expect(await attentionForOurService()).toBeUndefined();

    // Other services genuinely due on this vehicle must still be listed — booking an oil change
    // does not silence a due tyre rotation.
    const others = (await myAttention()).filter((i) => i.kind === "SERVICE_DUE" && i.vehicleId === vehicleId);
    expect(others.length).toBeGreaterThanOrEqual(1);
  });

  it("6. the T-24h job reminds the member, once", async () => {
    const appt = await prisma.appointment.findFirstOrThrow({ where: { vehicleId }, orderBy: { createdAt: "desc" } });
    const justBefore = new Date(appt.scheduledStart.getTime() - 2 * 60 * 60 * 1000);

    expect(await appointments.remindUpcoming(justBefore)).toEqual({ reminded: 1 });
    const afterFirst = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId);
    expect(afterFirst[0].kind).toBe("APPOINTMENT_REMINDER");

    // Hourly job: the second sweep must not re-notify.
    expect(await appointments.remindUpcoming(justBefore)).toEqual({ reminded: 1 });
    const afterSecond = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId);
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0].kind).toBe("APPOINTMENT_REMINDER");
  });

  it("7. cancelling returns the thread to due and it reappears on the dashboard", async () => {
    const appt = await prisma.appointment.findFirstOrThrow({ where: { vehicleId }, orderBy: { createdAt: "desc" } });
    await asMember().post(`/api/v1/appointments/${appt.id}/cancel`).expect(201);

    const mine = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId);
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe("SERVICE_DUE");

    expect(await attentionForOurService()).toBeDefined();
  });

  it("8. an admin broadcast lands in the same feed and read state is per-viewer", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: `${TAG} Shop closed`, body: "Closed for a public holiday." })
      .expect(201);

    const feed = await asMember().get("/api/v1/me/announcements").expect(200);
    const bc = feed.body.data.items.find((i: any) => i.title.includes(TAG) && i.kind === "ADMIN_BROADCAST");
    expect(bc).toBeDefined();
    expect(bc.read).toBe(false);
    expect(feed.body.data.unreadCount).toBeGreaterThanOrEqual(1);

    await asMember().post("/api/v1/announcements/read-all").expect(201);
    const after = await asMember().get("/api/v1/me/announcements").expect(200);
    expect(after.body.data.unreadCount).toBe(0);
  });

  it("9. a second service cycle opens a fresh thread once the first is closed", async () => {
    const open = await prisma.announcement.findFirstOrThrow({
      where: { vehicleId, serviceTypeId, status: "ACTIVE" },
    });
    await prisma.announcement.update({ where: { id: open.id }, data: { status: "SUPERSEDED" } });

    await runReminderCycle(new Date());

    const rows = await prisma.announcement.findMany({ where: { vehicleId, serviceTypeId } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.filter((r) => r.status === "ACTIVE")).toHaveLength(1);
  });

  it("10. rescheduling moves the thread and re-arms the reminder", async () => {
    // From step 9 onward the feed also carries SUPERSEDED history rows by design, so assert on
    // the one OPEN thread rather than on the total count.
    const ourOpenThread = async () => {
      const open = (await myThreads()).filter((t: any) => t.serviceTypeId === serviceTypeId && t.status === "ACTIVE");
      expect(open).toHaveLength(1);
      return open[0];
    };

    await bookOverHttp();
    expect((await ourOpenThread()).kind).toBe("APPOINTMENT_BOOKED");

    const appt = await prisma.appointment.findFirstOrThrow({
      where: { vehicleId, status: { in: ["BOOKED", "CONFIRMED"] } },
      orderBy: { createdAt: "desc" },
    });

    const slotsRes = await asMember()
      .get(`/api/v1/scheduling/slots?from=${DATE}&to=${DATE}&serviceTypeId=${serviceTypeId}`)
      .expect(200);
    const free = slotsRes.body.data.find((sl: any) => new Date(sl.start).getTime() !== appt.scheduledStart.getTime());
    expect(free).toBeDefined();

    const hold = await asMember()
      .post("/api/v1/scheduling/holds")
      .send({ bayId: free.bayId, start: free.start, serviceTypeId })
      .expect(201);

    await asMember()
      .patch(`/api/v1/appointments/${appt.id}/reschedule`)
      .send({ holdId: hold.body.data.holdId })
      .expect(200);

    expect((await ourOpenThread()).kind).toBe("APPOINTMENT_RESCHEDULED");

    // A member already reminded about the OLD date must be reminded again about the new one.
    const moved = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    const justBefore = new Date(moved.scheduledStart.getTime() - 2 * 60 * 60 * 1000);
    expect(await appointments.remindUpcoming(justBefore)).toEqual({ reminded: 1 });

    expect((await ourOpenThread()).kind).toBe("APPOINTMENT_REMINDER");
  });

});