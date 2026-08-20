import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AbilityFactory } from "./ability.factory";
import { PolicyGuard } from "./policy.guard";

@Global()
@Module({
  providers: [AbilityFactory, { provide: APP_GUARD, useClass: PolicyGuard }],
  exports: [AbilityFactory],
})
export class PoliciesModule {}
