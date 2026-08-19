import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("health (e2e)", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });
  afterAll(() => app.close());

  it("GET /api/v1/health returns enveloped ok", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" }, meta: null, error: null });
  });
  it("unknown route returns enveloped error with machine code", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/nope").expect(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error.code).toBe("string");
  });
});
