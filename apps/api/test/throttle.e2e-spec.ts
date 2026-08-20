import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";

describe("throttling (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService).useValue({ verifyIdToken: async () => ({ uid: "throttle-uid" }) })
      .compile();
    app = mod.createNestApplication(); app.setGlobalPrefix("api/v1"); await app.init();
  });
  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { firebaseUid: "throttle-uid" } });
    await app.close();
  });

  it("6th auth call within a minute returns 429 RATE_LIMITED (NFR-023)", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer t");
    }
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer t").expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});
