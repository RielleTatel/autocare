import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { SERVICE_TYPES } from "../prisma/seed-scheduling";

const TAG = `cfg-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

describe("scheduling config (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let advisorToken: string;
  let memberToken: string;
  let mechId: string;
  const codes = { st: `${TAG}-ST`, bay: `${TAG}-bay` };

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

    const advisor = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } });
    const member = await prisma.user.create({ data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } } });
    mechId = (await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, role: "MECHANIC" } })).id;
    advisorToken = await seal(advisor.id, "ADVISOR");
    memberToken = await seal(member.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      await prisma.capacityBlock.deleteMany({ where: { createdBy: { in: (await prisma.user.findMany({ where: { firebaseUid: { startsWith: TAG } }, select: { id: true } })).map((x) => x.id) } } });
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.operatingHours.deleteMany({ where: { dateOverride: "2027-04-01" } });
      await prisma.serviceBay.deleteMany({ where: { name: { startsWith: TAG } } });
      await prisma.serviceType.deleteMany({ where: { code: { startsWith: TAG } } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const advisor = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${advisorToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  it("advisor creates capacity config; member is forbidden", async () => {
    await advisor().post("/api/v1/scheduling/service-types").send({ code: codes.st, name: "Config Oil", standardDurationMin: 60, requiredSkills: ["OIL"], priceCentavos: 50000 }).expect(201);
    await advisor().post("/api/v1/scheduling/bays").send({ name: codes.bay, capabilities: ["OIL"] }).expect(201);
    await advisor().post("/api/v1/scheduling/shifts").send({ userId: mechId, date: "2027-04-01", startTime: "09:00", endTime: "17:00", skills: ["OIL"] }).expect(201);
    await advisor().put("/api/v1/scheduling/operating-hours").send({ dateOverride: "2027-04-01", openTime: "09:00", closeTime: "17:00", walkInBufferPct: 10 }).expect(200);

    const res = await member().post("/api/v1/scheduling/bays").send({ name: `${TAG}-x`, capabilities: [] }).expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("service-types are listable by a member (to pick a service)", async () => {
    const res = await member().get("/api/v1/scheduling/service-types").expect(200);
    expect(res.body.data.some((s: any) => s.code === codes.st)).toBe(true);
  });

  it("board query returns an array for staff and 403 for a member", async () => {
    const res = await advisor().get("/api/v1/scheduling/board?from=2027-04-01&to=2027-04-01").expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    await member().get("/api/v1/scheduling/board?from=2027-04-01&to=2027-04-01").expect(403);
  });

  it("seeds the exact maintenance intervals every reminder-generating service type needs", () => {
    // dueCandidates() selects only service types with a non-null interval, so a type
    // shipped without one is invisible to the daily reminder job — permanently.
    const EXPECTED: Record<string, { intervalDays: number | null; intervalKm: number | null }> = {
      OIL_CHANGE: { intervalDays: 180, intervalKm: 5000 },
      TIRE_ROTATION: { intervalDays: 180, intervalKm: 10000 },
      BRAKE_SERVICE: { intervalDays: null, intervalKm: 20000 },
      AC_SERVICE: { intervalDays: 365, intervalKm: null },
      FULL_INSPECTION: { intervalDays: 365, intervalKm: 15000 },
    };

    expect(SERVICE_TYPES.map((s) => s.code).sort()).toEqual(Object.keys(EXPECTED).sort());

    for (const st of SERVICE_TYPES) {
      expect({ intervalDays: st.intervalDays, intervalKm: st.intervalKm }).toEqual(EXPECTED[st.code]);
      expect(st.intervalDays ?? st.intervalKm).not.toBeNull();
    }
  });
});
