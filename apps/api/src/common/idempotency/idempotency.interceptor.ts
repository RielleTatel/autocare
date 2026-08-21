import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { DomainError } from "../errors/domain-error";
import { IDEMPOTENT_KEY } from "./idempotent.decorator";

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** Sentinel responseHash for a reserved-but-not-yet-completed key — a real sha256 hex digest is never empty. */
const IN_FLIGHT = "";
const POLL_INTERVAL_MS = 25;
const POLL_MAX_ATTEMPTS = 40; // ~1s worst case for a concurrent request to finish

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Sentinel returned by awaitReplayOrReclaim to mean "not a replay — this call now owns the row, run the handler." */
const NOT_A_REPLAY = Symbol("not-a-replay");

/**
 * Reusable Idempotency-Key handling for routes marked with `@Idempotent()`
 * (Ruling IDEMPOTENCY).
 *
 * - Missing `Idempotency-Key` header on a route that requires it -> 400
 *   `IDEMPOTENCY_KEY_REQUIRED`.
 * - **Race guard**: the key is *reserved* with an atomic `IdempotencyKey.create`
 *   BEFORE the wrapped handler runs (the row's PK is `key`, so a second
 *   concurrent request with the same key gets a Postgres unique-constraint
 *   violation, P2002, instead of silently racing past a `findUnique` that
 *   returned null for both). The loser of that race polls the winner's row
 *   until the winner's handler finishes (bounded — see POLL_MAX_ATTEMPTS) and
 *   replays its response, instead of re-running the handler itself. This is
 *   the fix for the "two concurrent requests both create a subscription"
 *   finding from code review — a `findUnique`-then-`upsert` pair (the
 *   previous implementation) has a check-then-act gap that a real unique
 *   constraint does not.
 * - First use of a key: the reservation row is created with a sentinel
 *   `responseHash: ""` ("in flight"); once the wrapped handler resolves, the
 *   row is updated in place with the real `responseHash`/`responseBody`.
 * - Replay (a *completed* row for the same key + endpoint, within 24h): the
 *   handler is *not* invoked. The stored response body is returned verbatim
 *   with HTTP 200 and an `X-Idempotent-Replay: true` header — matching API
 *   §9.1/§9.12 (`DUPLICATE_REQUEST` is documented there as HTTP 200 with the
 *   original response returned, not a thrown error).
 * - A key whose row is stale (>24h old) or was reserved for a *different*
 *   endpoint is reclaimed (its row is reset/updated in place) rather than
 *   treated as a replay, and the handler runs normally.
 *
 * `responseBody` is a Task 4 addition to the Task 1 `IdempotencyKey` schema
 * (which only had `responseHash`) — a hash alone can detect a mismatched
 * replay but cannot reconstruct the original response to return it, so
 * storing the body was necessary to satisfy "replay returns the original
 * response" from the brief/API spec.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const key = req.headers["idempotency-key"];
    if (!key || typeof key !== "string") {
      throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required", 400);
    }

    const endpoint = `${req.method} ${req.route?.path ?? req.url}`;
    const now = new Date();

    const reserved = await this.tryReserve(key, endpoint, now);
    if (!reserved) {
      const replayBody = await this.awaitReplayOrReclaim(key, endpoint, now);
      if (replayBody !== NOT_A_REPLAY) {
        res.status(200);
        res.setHeader("X-Idempotent-Replay", "true");
        return of(replayBody);
      }
      // Reclaimed a stale/different-endpoint row — we now own it; fall through and run the handler.
    }

    return next.handle().pipe(
      tap((data: unknown) => {
        const responseHash = createHash("sha256").update(JSON.stringify(data ?? null)).digest("hex");
        const responseBody = (data ?? Prisma.JsonNull) as Prisma.InputJsonValue;
        // Fire-and-forget: persisting the final response must not add latency to the response.
        void (async () => {
          try {
            await this.prisma.idempotencyKey.update({ where: { key }, data: { endpoint, responseHash, responseBody } });
          } catch {
            // best-effort persistence — a failed write must not surface as a 500 for an already-sent response
          }
        })();
      }),
    );
  }

  /** Atomically claims the key row. Returns true if this call now owns a fresh in-flight reservation. */
  private async tryReserve(key: string, endpoint: string, now: Date): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({
        data: { key, endpoint, responseHash: IN_FLIGHT, responseBody: Prisma.JsonNull, createdAt: now },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  }

  /**
   * Called when this request lost the reservation race. Polls the existing row:
   * - stale or different-endpoint -> reclaim it (update in place) and signal "not a replay"
   *   so the caller runs the handler.
   * - in-flight (sentinel hash) and still fresh -> poll until the winner finishes.
   * - completed and fresh -> return its responseBody as the replay.
   */
  private async awaitReplayOrReclaim(key: string, endpoint: string, now: Date): Promise<unknown> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });

      if (!existing) {
        // Row vanished between our failed create and this read (shouldn't happen — nothing deletes
        // rows) — try to reserve it ourselves.
        if (await this.tryReserve(key, endpoint, now)) return NOT_A_REPLAY;
        continue;
      }

      const isStale = now.getTime() - existing.createdAt.getTime() >= WINDOW_MS;
      const isDifferentEndpoint = existing.endpoint !== endpoint;
      if (isStale || isDifferentEndpoint) {
        try {
          await this.prisma.idempotencyKey.update({
            where: { key },
            data: { endpoint, responseHash: IN_FLIGHT, responseBody: Prisma.JsonNull, createdAt: now },
          });
          return NOT_A_REPLAY;
        } catch {
          continue; // someone else reclaimed it first — re-read and re-decide
        }
      }

      if (existing.responseHash === IN_FLIGHT) {
        await sleep(POLL_INTERVAL_MS);
        continue; // still waiting on the request that holds the reservation
      }

      return existing.responseBody; // completed, fresh, same endpoint — genuine replay
    }

    // Gave up waiting on an in-flight peer (should only happen if it crashed mid-request).
    // Run the handler ourselves rather than hanging the client forever; the row will be
    // overwritten with this call's result once it completes.
    return NOT_A_REPLAY;
  }
}
