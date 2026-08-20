import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [VehiclesModule, UsersModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
