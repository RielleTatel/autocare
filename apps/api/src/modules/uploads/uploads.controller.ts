import { Body, Controller, Inject, Post } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";

export const signedUrlSchema = z.object({
  vehicleId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png"]),
  kind: z.enum(["PHOTO", "ORCR"]),
});
const EXT = { "image/jpeg": "jpg", "image/png": "png" } as const;

@Controller("uploads")
export class UploadsController {
  constructor(@Inject(STORAGE_PORT) private storage: StoragePort, private vehicles: VehiclesService) {}

  @Post("signed-url")
  async signedUrl(@CurrentUser() user: AbilityUser,
                  @Body(new ZodValidationPipe(signedUrlSchema)) body: z.infer<typeof signedUrlSchema>) {
    const dto = signedUrlSchema.parse(body);
    await this.vehicles.findForUser(user, dto.vehicleId, "update"); // owner or admin only
    const path = `vehicles/${dto.vehicleId}/${randomUUID()}.${EXT[dto.contentType]}`;
    return this.storage.createUploadUrl(path, dto.contentType);
  }
}
