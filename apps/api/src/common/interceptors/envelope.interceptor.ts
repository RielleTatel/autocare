import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map } from "rxjs/operators";
import { RAW_RESPONSE } from "./raw-response.decorator";

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    // A @RawResponse() handler's body IS the payload (e.g. a CSV download);
    // wrapping it in the envelope would corrupt the document.
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [ctx.getHandler(), ctx.getClass()]);
    if (raw) return next.handle();

    return next.handle().pipe(map((data) => ({ success: true, data, meta: data?.__meta ?? null, error: null })));
  }
}
