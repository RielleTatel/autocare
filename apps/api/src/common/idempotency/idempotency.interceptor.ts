import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { Observable, from, of, throwError } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { DomainError } from "../errors/domain-error";
import { IDEMPOTENT_KEY } from "./idempotent.decorator";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const IN_FLIGHT = "";
const POLL_MAX_ATTEMPTS = 40;
const NOT_A_REPLAY = Symbol("not-a-replay");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Durable, principal-scoped response replay. An uncertain in-flight operation is never run twice. */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const suppliedKey = req.headers["idempotency-key"];
    if (typeof suppliedKey !== "string" || !suppliedKey.trim() || suppliedKey.length > 200) {
      throw new DomainError("IDEMPOTENCY_KEY_REQUIRED", "A nonempty Idempotency-Key of at most 200 characters is required", 400);
    }
    if (!req.user?.id) throw new DomainError("AUTH_TOKEN_INVALID", "Authentication is required", 401);

    // Include concrete resource IDs, not the route template. Store neither tokens nor raw keys.
    const key = `v2:${digest(`${req.user.id}:${suppliedKey}`)}`;
    const endpoint = `${req.method} ${req.originalUrl ?? req.url} ${digest(canonical(req.body))}`;
    const now = new Date();
    if (!(await this.tryReserve(key, endpoint, now))) {
      const replay = await this.awaitReplayOrReclaim(key, endpoint, now);
      if (replay !== NOT_A_REPLAY) {
        res.status(200);
        res.setHeader("X-Idempotent-Replay", "true");
        return of(replay);
      }
    }

    return next.handle().pipe(
      catchError((error) => from(this.prisma.idempotencyKey.deleteMany({
        where: { key, endpoint, responseHash: IN_FLIGHT },
      })).pipe(mergeMap(() => throwError(() => error)))),
      // Persist before responding. A persistence failure retains the reservation because
      // the operation itself may already have committed and must not be blindly repeated.
      mergeMap(async (data: unknown) => {
        const responseBody = JSON.parse(JSON.stringify(data ?? null)) as Prisma.InputJsonValue;
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: { endpoint, responseHash: digest(JSON.stringify(responseBody)), responseBody: responseBody ?? Prisma.JsonNull },
        });
        return data;
      }),
    );
  }

  private async tryReserve(key: string, endpoint: string, now: Date): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({
        data: { key, endpoint, responseHash: IN_FLIGHT, responseBody: Prisma.JsonNull, createdAt: now },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }

  private async awaitReplayOrReclaim(key: string, endpoint: string, now: Date): Promise<unknown> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
      if (!existing) {
        if (await this.tryReserve(key, endpoint, now)) return NOT_A_REPLAY;
        continue;
      }
      if (existing.endpoint !== endpoint) {
        throw new DomainError("DUPLICATE_REQUEST", "This Idempotency-Key belongs to a different request", 409);
      }
      if (existing.responseHash === IN_FLIGHT) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        continue;
      }
      if (now.getTime() - existing.createdAt.getTime() >= WINDOW_MS) {
        const reclaimed = await this.prisma.idempotencyKey.updateMany({
          where: { key, endpoint, createdAt: existing.createdAt, responseHash: existing.responseHash },
          data: { responseHash: IN_FLIGHT, responseBody: Prisma.JsonNull, createdAt: now },
        });
        if (reclaimed.count === 1) return NOT_A_REPLAY;
        continue;
      }
      return existing.responseBody;
    }
    throw new DomainError("DUPLICATE_REQUEST", "This operation is still processing; retry with the same Idempotency-Key", 409);
  }
}
