import { Body, Controller, Inject, Optional, Post } from "@nestjs/common";
import { randomUUID } from "crypto";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { STORAGE_PORT, StoragePort } from "../../common/storage/storage.port";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { VehiclesService } from "../vehicles/vehicles.service";
import { storagePathFromReference } from "../../common/storage/storage-reference";
import { PrismaService } from "../prisma/prisma.service";
import { inspectionPhotoUploadSchema, InspectionPhotoUploadInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";

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
  constructor(@Inject(STORAGE_PORT) private storage: StoragePort, private vehicles: VehiclesService, @Optional() private prisma?: PrismaService) {}

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

  @Post("inspection-signed-url")
  async inspectionSignedUrl(@CurrentUser() user: AbilityUser,
                            @Body(new ZodValidationPipe(inspectionPhotoUploadSchema)) dto: InspectionPhotoUploadInput) {
    if (!["MECHANIC", "ADMIN"].includes(user.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "only mechanics and administrators may attach inspection photos", 403);
    }
    const staff = await this.prisma!.user.findUnique({ where: { id: user.id }, select: { isCertifiedTechnician: true } });
    if (!staff?.isCertifiedTechnician) throw new DomainError("NOT_CERTIFIED_TECHNICIAN", "only certified technicians can attach inspection photos", 403);
    const inspection = await this.prisma!.inspection.findUnique({
      where: { clientUuid: dto.inspectionClientUuid },
      include: { results: { select: { pointCode: true } }, observations: { select: { clientUuid: true } } },
    });
    if (!inspection?.submittedAt) throw new DomainError("CHECKLIST_INVALID", "photos can be attached only after the inspection report is accepted", 409);
    const target = dto.target;
    if (target.type === "RESULT" && !inspection.results.some((result) => result.pointCode === target.pointCode)) {
      throw new DomainError("CHECKLIST_INVALID", "the photo check is not part of this accepted inspection", 422);
    }
    if (target.type === "OBSERVATION" && !inspection.observations.some((observation) => observation.clientUuid === target.observationClientUuid)) {
      throw new DomainError("CHECKLIST_INVALID", "the photo observation is not part of this accepted inspection", 422);
    }

    let photo = await this.prisma!.inspectionPhoto.findUnique({ where: { clientUuid: dto.clientUuid } });
    const expectedTarget = target.type;
    const expectedPointCode = target.type === "RESULT" ? target.pointCode : null;
    const observation = target.type === "OBSERVATION"
      ? await this.prisma!.inspectionObservation.findUnique({ where: { clientUuid: target.observationClientUuid }, select: { id: true } })
      : null;
    if (target.type === "OBSERVATION" && !observation) throw new DomainError("CHECKLIST_INVALID", "inspection observation not found", 404);
    if (!photo) {
      const path = `inspections/${inspection.vehicleId}/${inspection.id}/${randomUUID()}.${EXT[dto.contentType]}`;
      try {
        photo = await this.prisma!.inspectionPhoto.create({
          data: {
            clientUuid: dto.clientUuid,
            inspectionId: inspection.id,
            target: expectedTarget,
            pointCode: expectedPointCode,
            observationId: observation?.id ?? null,
            storagePath: path,
          },
        });
      } catch (error) {
        const concurrent = await this.prisma!.inspectionPhoto.findUnique({ where: { clientUuid: dto.clientUuid } });
        if (!concurrent) throw error;
        photo = concurrent;
      }
    }
    if (photo.inspectionId !== inspection.id || photo.target !== expectedTarget || photo.pointCode !== expectedPointCode || photo.observationId !== (observation?.id ?? null)) {
      throw new DomainError("DUPLICATE_REQUEST", "this photo id was already assigned to another inspection finding", 409);
    }
    const signed = await this.storage.createUploadUrl(photo.storagePath, dto.contentType);
    return { uploadUrl: signed.uploadUrl, storagePath: photo.storagePath };
  }
}
