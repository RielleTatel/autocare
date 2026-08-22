import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { of, firstValueFrom } from "rxjs";
import { DomainError } from "../errors/domain-error";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

const p2002 = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.22.0" });

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
  let prisma: { idempotencyKey: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
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
    prisma = { idempotencyKey: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
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
    expect(prisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it("throws IDEMPOTENCY_KEY_REQUIRED (400) when the header is missing on a required route", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const ctx = makeContext({}, makeRes());

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

  it("first use: reserves the key (create) before running the handler, then persists the real response via update", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.create.mockResolvedValue({});
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
    // Reservation happens before the handler is invoked (race guard).
    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyKey.create.mock.calls[0][0].data.responseHash).toBe(""); // in-flight sentinel
    expect(prisma.idempotencyKey.update).toHaveBeenCalledTimes(1);
    const call = prisma.idempotencyKey.update.mock.calls[0][0];
    expect(call.where).toEqual({ key: "key-abc" });
    expect(call.data.endpoint).toBe("POST /subscriptions");
    expect(call.data.responseBody).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(typeof call.data.responseHash).toBe("string");
    expect(call.data.responseHash.length).toBeGreaterThan(0);
  });

  it("replay: a completed row for the same key+endpoint within 24h short-circuits with 200 + X-Idempotent-Replay — handler not called", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.create.mockRejectedValue(p2002());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc", endpoint: "POST /subscriptions", responseHash: "abc",
      responseBody: { id: "sub-1", status: "ACTIVE" }, createdAt: new Date(),
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
    expect(prisma.idempotencyKey.update).not.toHaveBeenCalled();
  });

  it("concurrency: loses the reservation race, polls an in-flight row, and replays once the winner completes (handler runs exactly once)", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.create.mockRejectedValue(p2002());
    const inFlightRow = { key: "key-abc", endpoint: "POST /subscriptions", responseHash: "", responseBody: null, createdAt: new Date() };
    const completedRow = { ...inFlightRow, responseHash: "def", responseBody: { id: "sub-1", status: "ACTIVE" } };
    prisma.idempotencyKey.findUnique
      .mockResolvedValueOnce(inFlightRow)
      .mockResolvedValueOnce(inFlightRow)
      .mockResolvedValueOnce(completedRow);
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(0); // the loser never runs the handler
    expect(res.setHeader).toHaveBeenCalledWith("X-Idempotent-Replay", "true");
    expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledTimes(3);
  }, 10_000);

  it("expired row (older than 24h) is reclaimed — handler runs again and the row is refreshed", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.create.mockRejectedValue(p2002());
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc", endpoint: "POST /subscriptions", responseHash: "abc", responseBody: { id: "old" }, createdAt: stale,
    });
    prisma.idempotencyKey.update.mockResolvedValue({});
    interceptor = new IdempotencyInterceptor(reflector, prisma as never);
    const res = makeRes();
    const ctx = makeContext({ "idempotency-key": "key-abc" }, res);

    const result$ = await interceptor.intercept(ctx, handler);
    const data = await firstValueFrom(result$);
    await new Promise((r) => setImmediate(r));

    expect(data).toEqual({ id: "sub-1", status: "ACTIVE" });
    expect(handlerCallCount).toBe(1);
    // First update call reclaims the stale row; second (from the tap) persists the real response.
    expect(prisma.idempotencyKey.update).toHaveBeenCalledTimes(2);
  });

  it("a different endpoint reusing the same key is reclaimed as a fresh key (no false-positive replay)", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    prisma.idempotencyKey.create.mockRejectedValue(p2002());
    prisma.idempotencyKey.findUnique.mockResolvedValue({
      key: "key-abc", endpoint: "POST /other-resource", responseHash: "abc", responseBody: { id: "old" }, createdAt: new Date(),
    });
    prisma.idempotencyKey.update.mockResolvedValue({});
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
