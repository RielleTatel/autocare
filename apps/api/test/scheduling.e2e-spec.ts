import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID } from "crypto";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { RedisService } from "../src/common/redis/redis.service";

// Fixture prefix keeps every write scoped so cleanup never touches non-test rows on the shared
// Supabase DB (see plan Global Constraints — data safety).
const TAG = `sched-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

// 30 consecutive dates starting well in the future (dateOverride rows, so no weekday collision).
const DATES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2027, 0, 4) + i * 86_400_000); // 2027-01-04 onward
  return d.toISOString().slice(0, 10);
});
const DAY0 = DATES[0];

describe("scheduling — slots + holds (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let redis: RedisService;
  let serviceTypeId: string;
  let bayId: string;
  const mechId = randomUUID();

  const as = (uid: string) => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${uid}`);

  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    // Defensive pre-clean: operating_hours dateOverride rows are keyed by a GLOBAL calendar date
    // (not tag-scoped), so a leftover row from a crashed prior run would collide on the unique
    // index. These are test-only far-future dates real data never uses — safe to clear first.
    await prisma.operatingHours.deleteMany({ where: { dateOverride: { in: DATES } } });

    // Users: advisor (queries), two members (race), one mechanic (shift owner).
    await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    for (const m of ["m1", "m2"]) {
      await prisma.user.create({
        data: { firebaseUid: `${TAG}-${m}`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
      });
    }
    await prisma.user.create({ data: { id: mechId, firebaseUid: `${TAG}-mech`, role: "MECHANIC" } });

    const st = await prisma.serviceType.create({
      data: { code: `${TAG}-OIL`, name: "Oil Change", standardDurationMin: 60, requiredSkills: ["OIL"], priceCentavos: 50000n },
    });
    serviceTypeId = st.id;
    const bay = await prisma.serviceBay.create({ data: { name: `${TAG}-bay`, capabilities: ["OIL"] } });
    bayId = bay.id;

    // Operating hours + a mechanic shift for each of the 30 dates (batched to keep round-trips low).
    await prisma.operatingHours.createMany({
      data: DATES.map((date) => ({ dateOverride: date, openTime: "09:00", closeTime: "17:00", walkInBufferPct: 0 })),
    });
    await prisma.staffShift.createMany({
      data: DATES.map((date) => ({ userId: mechId, date, startTime: "09:00", endTime: "17:00", skills: ["OIL"] })),
    });
  });

  afterAll(async () => {
    // Cleanup must never abort before app.close() — an unclosed app leaves Redis/BullMQ handles
    // open and jest hangs. Wrap DB deletes and always close the app.
    try {
      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await redis.client.scan(cursor, "MATCH", `hold:${bayId}:*`, "COUNT", 200);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== "0");
      if (keys.length) await redis.client.del(...keys);

      await prisma.appointment.deleteMany({ where: { bayId } });
      // Delete shifts via the tagged-user join so a mismatched seed id can never orphan an FK.
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.operatingHours.deleteMany({ where: { dateOverride: { in: DATES } } });
      await prisma.serviceBay.deleteMany({ where: { id: bayId } });
      await prisma.serviceType.deleteMany({ where: { id: serviceTypeId } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  let firstSlot: { start: string; bayId: string };

  it("lists bookable slots for a day (FR-041)", async () => {
    const res = await as(`${TAG}-adv`).get(`/api/v1/scheduling/slots?from=${DAY0}&to=${DAY0}&serviceTypeId=${serviceTypeId}`).expect(200);
    expect(res.body.data.length).toBe(8); // 09:00..16:00 hourly
    firstSlot = { start: res.body.data[0].start, bayId: res.body.data[0].bayId };
    expect(firstSlot.bayId).toBe(bayId);
  });

  it("two racing holds on one slot: exactly one wins (FR-043)", async () => {
    const body = { bayId: firstSlot.bayId, start: firstSlot.start, serviceTypeId };
    const [a, b] = await Promise.all([
      as(`${TAG}-m1`).post("/api/v1/scheduling/holds").send(body),
      as(`${TAG}-m2`).post("/api/v1/scheduling/holds").send(body),
    ]);
    const codes = [a.status, b.status].sort();
    expect(codes).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("a held slot disappears from availability", async () => {
    const res = await as(`${TAG}-adv`).get(`/api/v1/scheduling/slots?from=${DAY0}&to=${DAY0}&serviceTypeId=${serviceTypeId}`).expect(200);
    expect(res.body.data.find((s: any) => s.start === firstSlot.start)).toBeUndefined();
    expect(res.body.data.length).toBe(7);
  });

  it("a 30-day slot query resolves under 800ms (NFR-005)", async () => {
    const t = Date.now();
    const res = await as(`${TAG}-adv`).get(`/api/v1/scheduling/slots?from=${DATES[0]}&to=${DATES[29]}&serviceTypeId=${serviceTypeId}`).expect(200);
    const elapsed = Date.now() - t;
    expect(res.body.data.length).toBeGreaterThan(200); // ~8 slots/day * 30 days minus a held one
    expect(elapsed).toBeLessThan(800);
  });
});
