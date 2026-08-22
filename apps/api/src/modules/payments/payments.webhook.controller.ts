import { Controller, Headers, HttpCode, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PROVIDER_PORT, ProviderPort } from "./provider.port";
import { PaymentsService } from "./payments.service";
import { DomainError } from "../../common/errors/domain-error";

/**
 * POST /webhooks/payments — PayMongo webhook receiver.
 *
 * Raw-body approach: main.ts bootstraps Nest with `{ rawBody: true }` (NestExpressApplication),
 * which makes Nest's body-parser middleware stash the original Buffer on `req.rawBody` for
 * every request *in addition to* populating the normally-parsed `req.body` — so this is the one
 * controller that needs the exact bytes for HMAC verification, and every other route (JSON
 * parsing, the global EnvelopeInterceptor which maps the *handler's return value*, not the
 * request) is unaffected.
 */
@Controller("webhooks")
export class PaymentsWebhookController {
  constructor(
    private payments: PaymentsService,
    @Inject(PROVIDER_PORT) private provider: ProviderPort,
  ) {}

  @Public()
  @Post("payments")
  @HttpCode(200)
  async handle(@Req() req: RawBodyRequest<object>, @Headers("paymongo-signature") signature?: string) {
    if (!req.rawBody) {
      // Should be unreachable once rawBody:true is configured — fail loudly rather than silently
      // verifying against an empty buffer.
      throw new DomainError("WEBHOOK_SIGNATURE_INVALID", "Raw body not captured", 401);
    }
    const event = this.provider.verifyWebhook(req.rawBody, signature ?? "");
    const { alreadyProcessed } = await this.payments.handleWebhook(event);
    return { received: true, alreadyProcessed };
  }
}
