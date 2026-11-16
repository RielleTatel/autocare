import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { firstValueFrom, of, Subject, throwError } from "rxjs";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

function setup() {
  const rows = new Map<string, any>();
  const prisma = { idempotencyKey: {
    create: jest.fn(async ({ data }) => {
      if (rows.has(data.key)) throw new Prisma.PrismaClientKnownRequestError("Duplicate", { code: "P2002", clientVersion: "5" });
      rows.set(data.key, { ...data });
      return data;
    }),
    findUnique: jest.fn(async ({ where }) => rows.has(where.key) ? { ...rows.get(where.key) } : null),
    update: jest.fn(async ({ where, data }) => { rows.set(where.key, { ...rows.get(where.key), ...data }); return rows.get(where.key); }),
    updateMany: jest.fn(async ({ where, data }) => {
      const row = rows.get(where.key);
      if (!row || row.endpoint !== where.endpoint || row.responseHash !== where.responseHash || row.createdAt !== where.createdAt) return { count: 0 };
      rows.set(where.key, { ...row, ...data });
      return { count: 1 };
    }),
    deleteMany: jest.fn(async ({ where }) => {
      const row = rows.get(where.key);
      if (!row || row.endpoint !== where.endpoint || row.responseHash !== where.responseHash) return { count: 0 };
      rows.delete(where.key);
      return { count: 1 };
    }),
  } };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
  const interceptor = new IdempotencyInterceptor(reflector as unknown as Reflector, prisma as never);
  const res = { status: jest.fn().mockReturnThis(), setHeader: jest.fn() };
  const context = (overrides: Record<string, unknown> = {}) => {
    const req = { method: "POST", url: "/subscriptions/one/upgrade", user: { id: "member-one" }, body: { planId: "premium" }, headers: { "idempotency-key": "same-operation" }, ...overrides };
    return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }), getHandler: () => function handler() {}, getClass: () => class Controller {} } as unknown as ExecutionContext;
  };
  const handler = { handle: jest.fn(() => of({ id: "subscription-one", invoiceId: "invoice-one" })) };
  const run = async (ctx = context(), next: CallHandler = handler) => firstValueFrom(await interceptor.intercept(ctx, next));
  return { rows, prisma, reflector, res, context, handler, interceptor, run };
}

describe("IdempotencyInterceptor durable operations", () => {
  it("passes through non-idempotent routes and rejects missing or invalid required keys", async () => {
    const s = setup();
    s.reflector.getAllAndOverride.mockReturnValue(false);
    await s.run(s.context({ headers: {} }));
    expect(s.prisma.idempotencyKey.create).not.toHaveBeenCalled();
    s.reflector.getAllAndOverride.mockReturnValue(true);
    for (const key of [undefined, "", "   ", "x".repeat(201)]) {
      await expect(s.run(s.context({ headers: { "idempotency-key": key } }))).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED", httpStatus: 400 });
    }
  });

  it("persists the completed result before responding and replays without another upgrade", async () => {
    const s = setup();
    await expect(s.run()).resolves.toEqual({ id: "subscription-one", invoiceId: "invoice-one" });
    expect([...s.rows.values()][0].responseBody).toEqual({ id: "subscription-one", invoiceId: "invoice-one" });
    await expect(s.run()).resolves.toEqual({ id: "subscription-one", invoiceId: "invoice-one" });
    expect(s.handler.handle).toHaveBeenCalledTimes(1);
    expect(s.res.status).toHaveBeenCalledWith(200);
    expect(s.res.setHeader).toHaveBeenCalledWith("X-Idempotent-Replay", "true");
  });

  it("isolates different authenticated users using the same raw key", async () => {
    const s = setup();
    await s.run();
    await s.run(s.context({ user: { id: "member-two" } }));
    expect(s.handler.handle).toHaveBeenCalledTimes(2);
    expect(s.rows.size).toBe(2);
    expect([...s.rows.keys()].join()).not.toContain("same-operation");
  });

  it("rejects a key reused for another payload or concrete subscription", async () => {
    const s = setup();
    await s.run();
    await expect(s.run(s.context({ body: { planId: "different-plan" } }))).rejects.toMatchObject({ code: "DUPLICATE_REQUEST", httpStatus: 409 });
    await expect(s.run(s.context({ url: "/subscriptions/two/upgrade" }))).rejects.toMatchObject({ code: "DUPLICATE_REQUEST", httpStatus: 409 });
    expect(s.handler.handle).toHaveBeenCalledTimes(1);
  });

  it("treats reordered JSON properties as the same operation", async () => {
    const s = setup();
    await s.run(s.context({ body: { planId: "premium", settings: { a: 1, b: 2 } } }));
    await s.run(s.context({ body: { settings: { b: 2, a: 1 }, planId: "premium" } }));
    expect(s.handler.handle).toHaveBeenCalledTimes(1);
  });

  it("never reruns an in-flight operation after the bounded wait and allows replay once complete", async () => {
    const s = setup();
    const pending = new Subject<unknown>();
    const handler = { handle: jest.fn(() => pending) };
    const first = s.run(s.context(), handler);
    await new Promise((resolve) => setImmediate(resolve));
    await expect(s.run(s.context(), handler)).rejects.toMatchObject({ code: "DUPLICATE_REQUEST", httpStatus: 409 });
    expect(handler.handle).toHaveBeenCalledTimes(1);
    pending.next({ invoiceId: "one-only" });
    pending.complete();
    await expect(first).resolves.toEqual({ invoiceId: "one-only" });
    await expect(s.run(s.context(), handler)).resolves.toEqual({ invoiceId: "one-only" });
    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it("releases a rejected operation so recovery may retry the same key", async () => {
    const s = setup();
    await expect(s.run(s.context(), { handle: () => throwError(() => new Error("provider unavailable")) })).rejects.toThrow("provider unavailable");
    expect(s.rows.size).toBe(0);
    await expect(s.run()).resolves.toHaveProperty("invoiceId", "invoice-one");
  });

  it("retains an uncertain committed operation if response persistence fails", async () => {
    const s = setup();
    s.prisma.idempotencyKey.update.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(s.run()).rejects.toThrow("database unavailable");
    expect(s.rows.size).toBe(1);
    await expect(s.run()).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
    expect(s.handler.handle).toHaveBeenCalledTimes(1);
  });

  it("atomically reclaims completed responses after the documented 24-hour window", async () => {
    const s = setup();
    await s.run();
    for (const row of s.rows.values()) row.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await s.run();
    expect(s.handler.handle).toHaveBeenCalledTimes(2);
    expect(s.prisma.idempotencyKey.updateMany).toHaveBeenCalledTimes(1);
  });
});
