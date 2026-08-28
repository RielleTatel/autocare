import { redisTargetFromUrl, assertRedisReachable } from "./preflight";

describe("redisTargetFromUrl", () => {
  it("reads host and port out of a redis url", () => {
    expect(redisTargetFromUrl("redis://localhost:6379")).toEqual({ host: "localhost", port: 6379 });
  });

  it("defaults the port when the url omits it", () => {
    expect(redisTargetFromUrl("redis://cache.internal")).toEqual({ host: "cache.internal", port: 6379 });
  });

  it("falls back to localhost when REDIS_URL is unset", () => {
    expect(redisTargetFromUrl(undefined)).toEqual({ host: "127.0.0.1", port: 6379 });
  });

  it("survives a malformed url rather than throwing during preflight", () => {
    expect(redisTargetFromUrl("not-a-url")).toEqual({ host: "127.0.0.1", port: 6379 });
  });
});

describe("assertRedisReachable", () => {
  it("resolves quietly when redis answers", async () => {
    await expect(assertRedisReachable("redis://localhost:6379", async () => true)).resolves.toBeUndefined();
  });

  it("throws an actionable message naming the target and how to start it", async () => {
    const err = await assertRedisReachable("redis://localhost:6379", async () => false).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain("localhost:6379");
    expect(message).toContain("redis-server");
  });

  it("explains why it aborts rather than letting the suite hang", async () => {
    const err = await assertRedisReachable("redis://localhost:6379", async () => false).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/hang|retries forever/i);
  });
});
