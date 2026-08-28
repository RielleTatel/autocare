import net from "node:net";

/**
 * Preflight for the test suite.
 *
 * Every e2e spec boots the Nest AppModule, which registers seven BullMQ queues.
 * BullMQ requires `maxRetriesPerRequest: null`, so when Redis is unreachable
 * ioredis retries the connection *forever* — each failure logging a multi-line
 * AggregateError. One spec produced 1,650 ECONNREFUSED errors and 773 KB of
 * output in 75 seconds, and the retry timers kept the event loop alive so jest
 * never exited. The suite looked hung with no output at all, because jest
 * buffers a suite's console output until that suite finishes.
 *
 * Rather than let that recur, fail immediately with something a human can act on.
 */

const DEFAULT_REDIS = { host: "127.0.0.1", port: 6379 };

/** Parse REDIS_URL into a connect target, falling back to localhost:6379. */
export function redisTargetFromUrl(url: string | undefined): { host: string; port: number } {
  if (!url) return { ...DEFAULT_REDIS };
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return { ...DEFAULT_REDIS };
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : DEFAULT_REDIS.port,
    };
  } catch {
    // A malformed URL must not itself crash preflight — fall back and let the
    // reachability probe deliver the actionable failure instead.
    return { ...DEFAULT_REDIS };
  }
}

/** True if something accepts a TCP connection at host:port inside the timeout. */
export function tcpReachable(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

export type Probe = (host: string, port: number) => Promise<boolean>;

/** Abort the run with an actionable message when Redis is not answering. */
export async function assertRedisReachable(
  url: string | undefined,
  probe: Probe = tcpReachable,
): Promise<void> {
  const { host, port } = redisTargetFromUrl(url);
  if (await probe(host, port)) return;

  throw new Error(
    [
      `Redis is not reachable at ${host}:${port} (REDIS_URL=${url ?? "unset"}).`,
      "",
      "Every e2e spec boots the AppModule, which starts seven BullMQ queues.",
      "BullMQ retries forever when Redis is down, so the suite would hang with no",
      "output instead of failing. Aborting now rather than letting that happen.",
      "",
      "Start it with:  redis-server --daemonize yes --port 6379",
    ].join("\n"),
  );
}
