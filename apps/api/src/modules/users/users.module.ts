import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConsentController } from "./consent.controller";
import { ConsentGuard } from "./consent.guard";

@Module({
  controllers: [ConsentController],
  providers: [{ provide: APP_GUARD, useClass: ConsentGuard }],
})
export class UsersModule {}
