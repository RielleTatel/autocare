import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { UsersService } from "../src/modules/users/users.service";

const TAG = `stf-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

const manilaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/**
 * Staff administration: the directory, role assignment, and roster management.
 *
 * Roles are the system's only privilege boundary, and sign-up hardcodes MEMBER,
 * so this endpoint is the sole path in and out of staff access. The guards below
 * are the point of the feature, not incidental validation.
 */
describe("staff administration (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let adminToken: string;
  let admin2Token: string;
  let advisorToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let adminId: string;
  let admin2Id: string;
  let memberId: string;
  let mechId: string;

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

    adminId = (await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, name: `${TAG} Admin`, role: "ADMIN" } })).id;
    admin2Id = (await prisma.user.create({ data: { firebaseUid: `${TAG}-adm2`, name: `${TAG} Admin Two`, role: "ADMIN" } })).id;
    memberId = (await prisma.user.create({
      data: { firebaseUid: `${TAG}-mem`, name: `${TAG} Member`, email: `${TAG}-member@example.com`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    })).id;
    mechId = (await prisma.user.create({ data: { firebaseUid: `${TAG}-mech`, name: `${TAG} Mechanic`, role: "MECHANIC" } })).id;
    const advisor = await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, name: `${TAG} Advisor`, role: "ADVISOR" } });

    adminToken = await seal(adminId, "ADMIN");
    admin2Token = await seal(admin2Id, "ADMIN");
    advisorToken = await seal(advisor.id, "ADVISOR");
    memberToken = await seal(memberId, "MEMBER");
    const outsider = await prisma.user.create({ data: { firebaseUid: `${TAG}-out`, role: "MEMBER" } });
    outsiderToken = await seal(outsider.id, "MEMBER");
  });

  afterAll(async () => {
    try {
      await prisma.staffShift.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: [adminId, admin2Id] } } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const admin = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${adminToken}`);
  const admin2 = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${admin2Token}`);
  const advisor = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${advisorToken}`);
  const member = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);
  /** Stays a MEMBER for the whole suite, unlike `member()` which gets promoted. */
  const outsider = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${outsiderToken}`);

  describe("directory", () => {
    it("lists staff only by default, and is admin-gated", async () => {
      const res = await admin().get("/api/v1/users/staff").expect(200);
      const roles: string[] = res.body.data.map((u: any) => u.role);
      expect(roles).not.toContain("MEMBER");
      expect(res.body.data.some((u: any) => u.id === mechId)).toBe(true);

      // An advisor runs the schedule but must not be able to grant roles or
      // enumerate accounts.
      await advisor().get("/api/v1/users/staff").expect(403);
      await member().get("/api/v1/users/staff").expect(403);
    });

    it("widens to members so someone can be found and promoted", async () => {
      const res = await admin().get("/api/v1/users/staff?scope=ALL").expect(200);
      expect(res.body.data.some((u: any) => u.id === memberId)).toBe(true);
    });

    it("searches by name or email", async () => {
      const res = await admin().get(`/api/v1/users/staff?scope=ALL&q=${TAG}-member@example.com`).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(memberId);
    });

    it("reports upcoming shifts so a demotion's cost is visible before it happens", async () => {
      await prisma.staffShift.create({ data: { userId: mechId, date: daysFromNow(3), startTime: "09:00", endTime: "18:00", skills: ["GENERAL"] } });
      const res = await admin().get("/api/v1/users/staff").expect(200);
      expect(res.body.data.find((u: any) => u.id === mechId).upcomingShifts).toBe(1);
    });
  });

  describe("role assignment", () => {
    it("promotes a member to mechanic and records why", async () => {
      const res = await admin()
        .patch(`/api/v1/users/${memberId}/role`)
        .send({ role: "MECHANIC", reason: "hired as workshop technician" })
        .expect(200);
      expect(res.body.data.role).toBe("MECHANIC");

      const audit = await prisma.auditLog.findFirst({
        where: { entityType: "User", entityId: memberId },
        orderBy: { createdAt: "desc" },
      });
      expect(audit?.action).toContain("hired as workshop technician");
    });

    it("rejects a change with no reason", async () => {
      await admin().patch(`/api/v1/users/${memberId}/role`).send({ role: "ADVISOR" }).expect(400);
    });

    it("refuses to let an admin change their own role", async () => {
      // The classic way to lock yourself out of your own console.
      const res = await admin().patch(`/api/v1/users/${adminId}/role`).send({ role: "MEMBER", reason: "stepping down" }).expect(403);
      expect(res.body.error.message).toMatch(/own role/i);
    });

    it("lets one admin demote another while a second admin remains", async () => {
      await admin2().patch(`/api/v1/users/${adminId}/role`).send({ role: "ADVISOR", reason: "moved to service desk" }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: adminId } })).role).toBe("ADVISOR");
      await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
    });

    // The "last active admin" guard is deliberately NOT tested here. It counts
    // admins across the whole database, so provoking it would mean suspending
    // every other real admin account on a shared dev DB — and a mid-test failure
    // would leave someone locked out of the console. It is covered in isolation
    // by users.service.spec.ts instead.

    it("clears future shifts when someone leaves a staff role, keeping past ones", async () => {
      const past = await prisma.staffShift.create({ data: { userId: mechId, date: "2026-01-05", startTime: "09:00", endTime: "18:00", skills: ["GENERAL"] } });
      const future = await prisma.staffShift.create({ data: { userId: mechId, date: daysFromNow(5), startTime: "09:00", endTime: "18:00", skills: ["GENERAL"] } });

      const res = await admin()
        .patch(`/api/v1/users/${mechId}/role`)
        .send({ role: "MEMBER", reason: "left the workshop" })
        .expect(200);

      // Scheduled capacity has to drop immediately, or the board keeps offering
      // slots nobody is rostered to work.
      expect(res.body.data.clearedShifts).toBeGreaterThanOrEqual(1);
      expect(await prisma.staffShift.findUnique({ where: { id: future.id } })).toBeNull();
      expect(await prisma.staffShift.findUnique({ where: { id: past.id } })).not.toBeNull();
    });

    it("leaves shifts alone when moving between two staff roles", async () => {
      const u = await prisma.user.create({ data: { firebaseUid: `${TAG}-mv`, role: "MECHANIC" } });
      const shift = await prisma.staffShift.create({ data: { userId: u.id, date: daysFromNow(4), startTime: "09:00", endTime: "18:00", skills: ["GENERAL"] } });

      await admin().patch(`/api/v1/users/${u.id}/role`).send({ role: "ADVISOR", reason: "promoted to service advisor" }).expect(200);

      expect(await prisma.staffShift.findUnique({ where: { id: shift.id } })).not.toBeNull();
    });
  });

  describe("roster management", () => {
    let shiftId: string;

    it("advisors can manage the roster — this is scheduling, not privilege", async () => {
      const res = await advisor()
        .post("/api/v1/scheduling/shifts")
        .send({ userId: mechId, date: daysFromNow(7), startTime: "09:00", endTime: "18:00", skills: ["GENERAL"] })
        .expect(201);
      shiftId = res.body.data.id;

      // A never-promoted account: `member()` above gets promoted by the role
      // tests, and reusing it here would assert nothing.
      await outsider()
        .post("/api/v1/scheduling/shifts")
        .send({ userId: mechId, date: daysFromNow(7), startTime: "09:00", endTime: "18:00", skills: [] })
        .expect(403);
    });

    it("lists the roster for a range with the person attached", async () => {
      const res = await advisor()
        .get(`/api/v1/scheduling/shifts?from=${manilaToday()}&to=${daysFromNow(14)}`)
        .expect(200);
      const row = res.body.data.find((s: any) => s.id === shiftId);
      expect(row).toBeDefined();
      expect(row.userName).toContain(TAG);
    });

    it("extends a shift, which is the lever that moves the last bookable slot", async () => {
      const res = await advisor().patch(`/api/v1/scheduling/shifts/${shiftId}`).send({ endTime: "21:00" }).expect(200);
      expect(res.body.data.endTime).toBe("21:00");
    });

    it("rejects a shift that ends before it starts", async () => {
      // Such a shift contributes no capacity but still looks rostered.
      await advisor().patch(`/api/v1/scheduling/shifts/${shiftId}`).send({ endTime: "08:00" }).expect(422);
      await advisor()
        .post("/api/v1/scheduling/shifts")
        .send({ userId: mechId, date: daysFromNow(8), startTime: "18:00", endTime: "09:00", skills: [] })
        .expect(422);
    });

    it("deletes a shift, and reports a missing one rather than failing silently", async () => {
      await advisor().delete(`/api/v1/scheduling/shifts/${shiftId}`).expect(200);
      expect(await prisma.staffShift.findUnique({ where: { id: shiftId } })).toBeNull();
      await advisor().delete(`/api/v1/scheduling/shifts/${shiftId}`).expect(404);
    });
  });
});
