import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of, firstValueFrom } from "rxjs";
import { DomainError } from "../errors/domain-error";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

function makeContext(headers: Record<string, string | undefined>, res: { statusCode: number; setHeader: jest.Mock; status: jest.Mock }) {
  const req = { method: "POST", url: "/api/v1/subscriptions", headers, route: { path: "/subscriptions" } };
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

function makeRes() {
  return { statusCode: 201, setHeader: jest.fn(), status: jest.fn().mockReturnThis() };
}

describe("IdempotencyInterceptor", () => {
  let prisma: { idempotencyKey: { findUnique: jest.Mock; upsert: jest.Mock } };
  let reflector: Reflector;
  let interceptor: IdempotencyInterceptor;
  let handlerCallCount: number;
  const handler: CallHandler = {
    handle: () => {
      handlerCallCount += 1;
      return of({ id: "sub-1", status: "ACTIVE" });
    },
  };

  beforeEach(() => {
    handlerCallCount = 0;
    prisma = { idempotencyKey: { findUnique: jest.fn(), upsert: jest.fn() } };
    reflector = new Reflector();
  });

  it("passes through untouched when the route isn't marked @Idempotent (no header check, no prisma calls)", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({}, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled();
  });

  it("throws IDEMPOTENCY_KEY_REQUIRED (400) when the header is missing on a required route", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const ctx = makeContext({}, makeRes());

    await expect(interceptor.intercept(ctx, handler)).rejects.toThrow(DomainError);
    try {
      await interceptor.intercept(ctx, handler);
      fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect((e as DomainError).httpStatus).toBe(400);
    }
    expect(handlerCallCount).toBe(0);
  });

  it("first use: no stored key -> calls the handler and persists key+endpoint+hash+body", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.findUnique.mockResolvedValue(null);
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);
    // allow the fire-and-forget persistence microtask to flush
    await new Promise((r) => setImmediate(r));

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.idempotencyKey.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: "key-abc" });
    expect(call.create.endpoint).toBe("POST /subscriptions");
    expect(call.create.responseBody).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(typeof call.create.responseHash).toBe("string");
    expect(call.create.responseHash.length).toBeGreaterThan(0);
  });

  it("replay: stored key within the 24h window short-circuits with the stored body, 200, and X-Idempotent-Replay header — handler is not called", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc",
      endpoint: "POST /subscriptions",
      responseHash: "abc",
      responseBody: { id: "sub-1", status: "ACTIVE" },
      createdAt: new Date(), // just now — well within 24h
    });
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(0);
    expect(res.setHeader).toHaveBeenCalledWith("X-Idempotent-Replay", "true");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.idempotencyKey.upsert).not.toHaveBeenCalled();
  });

  it("expired key (older than 24h) is treated as new — handler runs again and the key is refreshed", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc",
      endpoint: "POST /subscriptions",
      responseHash: "abc",
      responseBody: { id: "old" },
      createdAt: stale,
    });
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
    expect(prisma.idempotencyKey.upsert).toHaveBeenCalledTimes(1);
  });

  it("a different endpoint reusing the same key is treated as a fresh key (no false-positive replay)", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc",
      endpoint: "POST /other-resource",
      responseHash: "abc",
      responseBody: { id: "old" },
      createdAt: new Date(),
    });
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
  });
});
