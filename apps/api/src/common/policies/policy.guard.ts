import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AbilityFactory } from "./ability.factory";
import { CHECK_POLICY_KEY, PolicyHandler } from "./check-policy.decorator";
import { DomainError } from "../errors/domain-error";

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(private reflector: Reflector, private factory: AbilityFactory) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) return true; // public route — AuthGuard already decided
    req.ability = this.factory.for(req.user);
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICY_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (handlers.some((h) => !h(req.ability))) {
      throw new DomainError("FORBIDDEN_ROLE", "Your role cannot perform this action", 403);
    }
    return true;
  }
}
