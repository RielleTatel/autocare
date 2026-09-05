import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const TAG = `ann-${randomUUID().slice(0, 8)}`;
const POLICY = "2026-08-privacy-v1";

async function seal(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt().setExpirationTime("12h").encrypt(key);
}

describe("announcements (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let memberToken: string;
  let otherToken: string;
  let adminToken: string;
  let memberId: string;
  let otherId: string;
  let vehicleId: string;

  beforeAll(async () => {
    process.env.POLICY_VERSION = POLICY;
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async (t: string) => ({ uid: t }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);

    const member = await prisma.user.create({
      data: { firebaseUid: `${TAG}-mem`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    });
    const other = await prisma.user.create({
      data: { firebaseUid: `${TAG}-other`, role: "MEMBER", consents: { create: { policyVersion: POLICY } } },
    });
    const admin = await prisma.user.create({ data: { firebaseUid: `${TAG}-adm`, role: "ADMIN" } });
    memberId = member.id;
    otherId = other.id;
    memberToken = await seal(member.id, "MEMBER");
    otherToken = await seal(other.id, "MEMBER");
    adminToken = await seal(admin.id, "ADMIN");

    vehicleId = (
      await prisma.vehicle.create({
        data: {
          ownerUserId: memberId, plateNo: `AN${randomUUID().slice(0, 5).toUpperCase()}`,
          make: "Toyota", model: "Vios", year: 2022,
          fuelType: "GASOLINE", transmission: "AT", currentOdometerKm: 0,
        },
      })
    ).id;
  });

  afterAll(async () => {
    try {
      const mine = await prisma.announcement.findMany({
        where: { OR: [{ userId: { in: [memberId, otherId] } }, { title: { startsWith: TAG } }] },
        select: { id: true },
      });
      await prisma.announcementRead.deleteMany({ where: { announcementId: { in: mine.map((m) => m.id) } } });
      await prisma.announcement.deleteMany({ where: { id: { in: mine.map((m) => m.id) } } });
      await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
      await prisma.consentRecord.deleteMany({ where: { user: { firebaseUid: { startsWith: TAG } } } });
      await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    } finally {
      await app.close();
    }
  });

  const asMember = () => request.agent(app.getHttpServer()).set("Authorization", `Bearer ${memberToken}`);

  it("returns an empty feed for a member with nothing", async () => {
    const res = await asMember().get("/api/v1/me/announcements").expect(200);
    expect(res.body.data).toEqual({ items: [], unreadCount: 0 });
  });

  it("shows an admin broadcast to a member and marks it read", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: `${TAG} Holiday hours`, body: "Closed Dec 25." })
      .expect(201);

    const feed = await asMember().get("/api/v1/me/announcements").expect(200);
    const item = feed.body.data.items.find((i: any) => i.title.includes(TAG));
    expect(item).toBeDefined();
    expect(item.read).toBe(false);
    expect(feed.body.data.unreadCount).toBeGreaterThan(0);

    await asMember().post(`/api/v1/announcements/${item.id}/read`).expect(201);

    const after = await asMember().get("/api/v1/me/announcements").expect(200);
    expect(after.body.data.items.find((i: any) => i.id === item.id).read).toBe(true);
  });

  it("refuses a broadcast from a member", async () => {
    await asMember()
      .post("/api/v1/admin/announcements")
      .send({ title: `${TAG} nope`, body: "nope" })
      .expect(403);
  });

  it("rejects an invalid broadcast body", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "", body: "x" })
      .expect(400);
  });

  it("never leaks another member's thread", async () => {
    await prisma.announcement.create({
      data: {
        userId: otherId, vehicleId: null, serviceTypeId: null,
        kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} private`, body: "x",
      },
    });

    const res = await asMember().get("/api/v1/me/announcements").expect(200);
    expect(res.body.data.items.find((i: any) => i.title.includes("private"))).toBeUndefined();

    const asOther = await request(app.getHttpServer())
      .get("/api/v1/me/announcements")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    expect(asOther.body.data.items.find((i: any) => i.title.includes("private"))).toBeDefined();
  });

  it("dismisses the caller's own thread but not someone else's", async () => {
    const mine = await prisma.announcement.create({
      data: {
        userId: memberId, vehicleId, serviceTypeId: null,
        kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} mine`, body: "x",
      },
    });
    await asMember().post(`/api/v1/announcements/${mine.id}/dismiss`).expect(201);
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("DISMISSED");

    const theirs = await prisma.announcement.create({
      data: {
        userId: otherId, vehicleId: null, serviceTypeId: null,
        kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} theirs`, body: "x",
      },
    });
    await asMember().post(`/api/v1/announcements/${theirs.id}/dismiss`).expect(404);
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe("ACTIVE");
  });

  it("marks every visible announcement read in one call", async () => {
    await asMember().post("/api/v1/announcements/read-all").expect(201);
    const res = await asMember().get("/api/v1/me/announcements").expect(200);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it("a dismissed thread stops counting toward the unread badge", async () => {
    await asMember().post("/api/v1/announcements/read-all").expect(201);

    const t = await prisma.announcement.create({
      data: {
        userId: memberId, vehicleId, serviceTypeId: null,
        kind: "SERVICE_DUE", status: "ACTIVE", title: `${TAG} nag`, body: "x",
      },
    });
    expect((await asMember().get("/api/v1/me/announcements")).body.data.unreadCount).toBe(1);

    await asMember().post(`/api/v1/announcements/${t.id}/dismiss`).expect(201);

    const after = (await asMember().get("/api/v1/me/announcements")).body.data;
    expect(after.unreadCount).toBe(0);
  });

  it("dismissing a broadcast clears it for that viewer ONLY, never for everyone", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: `${TAG} dismissable`, body: "x" })
      .expect(201);
    const feed = (await asMember().get("/api/v1/me/announcements")).body.data;
    const bc = feed.items.find((i: any) => i.title.includes("dismissable"));
    await asMember().post(`/api/v1/announcements/${bc.id}/dismiss`).expect(201);

    // The row is shared by every member, so it must still be ACTIVE and still visible to
    // someone else — dismissing must never blank a shop notice for the whole customer base.
    expect((await prisma.announcement.findUniqueOrThrow({ where: { id: bc.id } })).status).toBe("ACTIVE");
    const other = await request(app.getHttpServer())
      .get("/api/v1/me/announcements")
      .set("Authorization", `Bearer ${otherToken}`)
      .expect(200);
    const seenByOther = other.body.data.items.find((i: any) => i.id === bc.id);
    expect(seenByOther).toBeDefined();
    expect(seenByOther.read).toBe(false);
  });


  it("hides an expired broadcast but keeps a future-dated one", async () => {
    await prisma.announcement.create({
      data: {
        userId: null, kind: "ADMIN_BROADCAST", status: "ACTIVE",
        title: `${TAG} expired notice`, body: "x",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.announcement.create({
      data: {
        userId: null, kind: "ADMIN_BROADCAST", status: "ACTIVE",
        title: `${TAG} live notice`, body: "x",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const items = (await asMember().get("/api/v1/me/announcements").expect(200)).body.data.items;
    expect(items.find((i: any) => i.title.includes("expired notice"))).toBeUndefined();
    expect(items.find((i: any) => i.title.includes("live notice"))).toBeDefined();
  });

});