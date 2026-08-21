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

/**
 * Reusable Idempotency-Key handling for routes marked with `@Idempotent()`
 * (Ruling IDEMPOTENCY).
 *
 * - Missing `Idempotency-Key` header on a route that requires it -> 400
 *   `IDEMPOTENCY_KEY_REQUIRED`.
 * - First use of a key: the wrapped handler runs normally; its resolved
 *   response is persisted as `IdempotencyKey { key, endpoint, responseHash,
 *   responseBody }` after the response is emitted downstream (fire-and-forget
 *   — a slow write must never delay the client response).
 * - Replay (same key seen again for the same endpoint, within 24h): the
 *   handler is *not* invoked. The stored response body is returned verbatim
 *   with HTTP 200 and an `X-Idempotent-Replay: true` header — matching API
 *   §9.1/§9.12 (`DUPLICATE_REQUEST` is documented there as HTTP 200 with the
 *   original response returned, not a thrown error).
 * - A key older than the 24h window, or reused against a *different*
 *   endpoint, is treated as brand new (no false-positive replay; the record
 *   is simply overwritten).
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
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    const isFreshReplay =
      !!existing && existing.endpoint === endpoint && Date.now() - existing.createdAt.getTime() < WINDOW_MS;

    if (isFreshReplay) {
      res.status(200);
      res.setHeader("X-Idempotent-Replay", "true");
      return of(existing!.responseBody);
    }

    return next.handle().pipe(
      tap((data: unknown) => {
        const responseHash = createHash("sha256").update(JSON.stringify(data ?? null)).digest("hex");
        const responseBody = (data ?? Prisma.JsonNull) as Prisma.InputJsonValue;
        // Fire-and-forget: persisting the replay record must not add latency to the response.
        void (async () => {
          try {
            await this.prisma.idempotencyKey.upsert({
              where: { key },
              create: { key, endpoint, responseHash, responseBody },
              update: { endpoint, responseHash, responseBody, createdAt: new Date() },
            });
          } catch {
            // best-effort persistence — a failed write must not surface as a 500 for an already-sent response
          }
        })();
      }),
    );
  }
}
