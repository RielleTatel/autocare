import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { DomainError } from "../errors/domain-error";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new DomainError("RATE_LIMITED", "Too many requests — try again in a minute", 429);
  }
}
