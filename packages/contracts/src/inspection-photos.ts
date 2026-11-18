import { z } from "zod";

const imageContentType = z.enum(["image/jpeg", "image/png"]);

export const inspectionPhotoTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("RESULT"), pointCode: z.string().min(1).max(64) }),
  z.object({ type: z.literal("OBSERVATION"), observationClientUuid: z.string().uuid() }),
]);

export const inspectionPhotoUploadSchema = z.object({
  inspectionClientUuid: z.string().uuid(),
  clientUuid: z.string().uuid(),
  contentType: imageContentType,
  target: inspectionPhotoTargetSchema,
});
export type InspectionPhotoUploadInput = z.infer<typeof inspectionPhotoUploadSchema>;

export const inspectionPhotoAttachSchema = inspectionPhotoUploadSchema.extend({
  storagePath: z.string().min(1).max(2048),
});
export type InspectionPhotoAttachInput = z.infer<typeof inspectionPhotoAttachSchema>;

export const inspectionPhotoReadSchema = z.object({
  storageReference: z.string().min(1).max(2048),
});
export type InspectionPhotoReadInput = z.infer<typeof inspectionPhotoReadSchema>;
