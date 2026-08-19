import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { FirebaseService } from "../src/modules/auth/firebase.service";

describe("auth (e2e)", () => {
  let app: any;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue({ verifyIdToken: async (t: string) => { if (t !== "good-token") throw new Error("bad"); return { uid: "fb-123", phone: "+639170000000" }; } })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(() => app.close());

  it("exchanges a valid Firebase token for a session, creating the user", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session")
      .set("Authorization", "Bearer good-token").expect(201);
    expect(res.body.data.user.firebaseUid).toBe("fb-123");
    expect(res.body.data.user.role).toBe("MEMBER");
  });
  it("is idempotent — same uid returns same user id", async () => {
    const a = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer good-token");
    const b = await request(app.getHttpServer()).post("/api/v1/auth/session").set("Authorization", "Bearer good-token");
    expect(a.body.data.user.id).toBe(b.body.data.user.id);
  });
  it("rejects an invalid token with AUTH_TOKEN_INVALID", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/session")
      .set("Authorization", "Bearer bad-token").expect(401);
    expect(res.body.error.code).toBe("AUTH_TOKEN_INVALID");
  });
  it("guards a protected route", async () => {
    await request(app.getHttpServer()).get("/api/v1/users/me").expect(401);
  });
});
