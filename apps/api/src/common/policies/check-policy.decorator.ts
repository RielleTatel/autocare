import { SetMetadata } from "@nestjs/common";
import type { AppAbility } from "./ability.factory";

export type PolicyHandler = (ability: AppAbility) => boolean;
export const CHECK_POLICY_KEY = "check_policy";
export const CheckPolicy = (...handlers: PolicyHandler[]) => SetMetadata(CHECK_POLICY_KEY, handlers);
