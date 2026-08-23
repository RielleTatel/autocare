import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createCertificateSchema, setVisibilitySchema, verifyCertificateSchema,
  CreateCertificateInput, SetVisibilityInput, VerifyCertificateInput,
} from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../auth/public.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { CertificatesService } from "./certificates.service";

@Controller()
export class CertificatesController {
  constructor(private certificates: CertificatesService) {}

  @Post("vehicles/:vehicleId/certificates")
  create(@CurrentUser() u: AbilityUser, @Param("vehicleId") vehicleId: string, @Body(new ZodValidationPipe(createCertificateSchema)) dto: CreateCertificateInput) {
    return this.certificates.create(u, vehicleId, dto.healthScoreId);
  }

  @Patch("certificates/:id/visibility")
  setVisibility(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(setVisibilitySchema)) dto: SetVisibilityInput) {
    return this.certificates.setVisibility(u, id, dto.visibility);
  }

  @Public()
  @Get("public/certificates/:token")
  publicByToken(@Param("token") token: string) {
    return this.certificates.publicByToken(token);
  }

  @Public()
  @Post("public/certificates/verify")
  verify(@Body(new ZodValidationPipe(verifyCertificateSchema)) dto: VerifyCertificateInput) {
    return this.certificates.verifyByCode(dto.code);
  }
}
