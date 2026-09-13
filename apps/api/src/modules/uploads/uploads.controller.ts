import { Body, Controller, Inject, Post } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { storagePathFromReference } from "../../common/storage/storage-reference";

export const signedUrlSchema = z.object({
  vehicleId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png"]),
  kind: z.enum(["PHOTO", "ORCR"]),
});
const signedReadUrlSchema = z.object({
  vehicleId: z.string().uuid(),
  storageReference: z.string().min(1).max(2048),
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
    return { ...(await this.storage.createUploadUrl(path, dto.contentType)), storagePath: path };
  }

  @Post("signed-read-url")
  async signedReadUrl(@CurrentUser() user: AbilityUser,
                      @Body(new ZodValidationPipe(signedReadUrlSchema)) body: z.infer<typeof signedReadUrlSchema>) {
    await this.vehicles.findForUser(user, body.vehicleId, "read");
    const path = storagePathFromReference(body.storageReference, process.env.SUPABASE_STORAGE_BUCKET as string);
    if (!path || !path.startsWith(`vehicles/${body.vehicleId}/`)) {
      throw new Error("Invalid vehicle storage reference");
    }
    return { signedUrl: await this.storage.createDownloadUrl(path, 60 * 60) };
  }
}
