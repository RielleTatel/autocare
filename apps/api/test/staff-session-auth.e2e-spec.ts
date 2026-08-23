import { Test } from "@nestjs/testing";
import request from "supertest";
import { randomUUID, createHash } from "crypto";
import { EncryptJWT } from "jose";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

const TAG = `staffauth-${randomUUID().slice(0, 8)}`;

// Seal a session token exactly like apps/web lib/auth/session.ts (dir + A256GCM, key = SHA-256 of
// SESSION_SECRET) so the API's AuthGuard opens it via the shared secret.
async function sealSession(uid: string, role: string): Promise<string> {
  const key = new Uint8Array(createHash("sha256").update(process.env.SESSION_SECRET as string).digest());
  return new EncryptJWT({ uid, role })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .encrypt(key);
}

describe("staff web session auth (e2e)", () => {
  let app: any;
  let prisma: PrismaService;
  let advisorId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async () => { throw new Error("firebase should not be called for a sealed session"); } })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    prisma = app.get(PrismaService);
    advisorId = (await prisma.user.create({ data: { firebaseUid: `${TAG}-adv`, role: "ADVISOR" } })).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { firebaseUid: { startsWith: TAG } } });
    await app.close();
  });

  it("accepts a sealed staff session token on an authed route (no Firebase call)", async () => {
    const token = await sealSession(advisorId, "ADVISOR");
    const res = await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects a garbage token with 401", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("rejects a sealed token whose user no longer exists with 401", async () => {
    const token = await sealSession(randomUUID(), "ADVISOR");
    await request(app.getHttpServer())
      .get("/api/v1/appointments")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });
});
