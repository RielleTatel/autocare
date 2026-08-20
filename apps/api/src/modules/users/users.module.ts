import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConsentController } from "./consent.controller";
import { ConsentGuard } from "./consent.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { DpaProcessor } from "./dpa.processor";
import { QueueModule } from "../../common/queue/queue.module";
import { AuditService } from "../../common/audit/audit.service";
import { STORAGE_PORT } from "../../common/storage/storage.port";
import { FsStorageAdapter } from "../../common/storage/fs-storage.adapter";
import { FirebaseStorageAdapter } from "../../common/storage/firebase-storage.adapter";

@Module({
  imports: [QueueModule],
  controllers: [ConsentController, UsersController],
  providers: [
    { provide: APP_GUARD, useClass: ConsentGuard },
    UsersService,
    AuditService,
    DpaProcessor,
    { provide: STORAGE_PORT, useClass: process.env.NODE_ENV === "test" ? FsStorageAdapter : FirebaseStorageAdapter },
  ],
  exports: [AuditService, STORAGE_PORT],
})
export class UsersModule {}
