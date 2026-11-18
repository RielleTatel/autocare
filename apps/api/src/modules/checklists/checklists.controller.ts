import { Body, Controller, Get, Headers, Param, Patch, Post, Res } from "@nestjs/common";
type Response = {
  setHeader(name: string, value: string): void;
  status(code: number): { end(): void };
  json(body: unknown): void;
};
import {
  checklistDraftPatchSchema, inspectionTemplateCreateSchema, inspectionTemplateVersionCreateSchema,
  previewScoreSchema, ChecklistDraftPatch, InspectionTemplateCreate, InspectionTemplateVersionCreate, PreviewScoreInput,
} from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { ChecklistsService } from "./checklists.service";

@Controller()
export class ChecklistsController {
  constructor(private checklists: ChecklistsService) {}

  /** Staff-cached read: ETag is the version label so the field app can 304-refresh. */
  @Get("checklists/active")
  async active(@CurrentUser() u: AbilityUser, @Headers("if-none-match") inm: string | undefined, @Res() res: Response) {
    const data = await this.checklists.getActive(u);
    const etag = `"${data.versionLabel}:${data.weightVersion}"`;
    res.setHeader("ETag", etag);
    if (inm && inm === etag) {
      res.status(304).end();
      return;
    }
    // @Res bypasses the envelope interceptor — mirror its shape by hand.
    res.json({ success: true, data });
  }

  @Get("admin/checklists")
  list(@CurrentUser() u: AbilityUser) {
    return this.checklists.list(u);
  }

  @Get("admin/checklists/:id")
  get(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.checklists.get(u, id);
  }

  @Post("admin/checklists")
  createDraft(@CurrentUser() u: AbilityUser) {
    return this.checklists.createDraft(u);
  }

  @Patch("admin/checklists/:id")
  patch(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(checklistDraftPatchSchema)) dto: ChecklistDraftPatch) {
    return this.checklists.patchDraft(u, id, dto);
  }

  @Post("admin/checklists/:id/publish")
  publish(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    return this.checklists.publish(u, id);
  }

  @Post("admin/checklists/:id/preview-score")
  preview(@CurrentUser() u: AbilityUser, @Param("id") id: string, @Body(new ZodValidationPipe(previewScoreSchema)) dto: PreviewScoreInput) {
    return this.checklists.previewScore(u, id, dto);
  }

  @Get("admin/inspection-templates")
  listTemplates(@CurrentUser() u: AbilityUser) {
    return this.checklists.listTemplates(u);
  }

  @Get("admin/inspection-templates/:templateId")
  getTemplate(@CurrentUser() u: AbilityUser, @Param("templateId") templateId: string) {
    return this.checklists.getTemplate(u, templateId);
  }

  @Post("admin/inspection-templates")
  createTemplate(@CurrentUser() u: AbilityUser, @Body(new ZodValidationPipe(inspectionTemplateCreateSchema)) dto: InspectionTemplateCreate) {
    return this.checklists.createTemplate(u, dto);
  }

  @Post("admin/inspection-templates/:templateId/versions")
  createTemplateVersion(@CurrentUser() u: AbilityUser, @Param("templateId") templateId: string,
                        @Body(new ZodValidationPipe(inspectionTemplateVersionCreateSchema)) dto: InspectionTemplateVersionCreate) {
    return this.checklists.createTemplateVersion(u, templateId, dto);
  }

  @Patch("admin/inspection-templates/:templateId/versions/:versionId")
  patchTemplateVersion(@CurrentUser() u: AbilityUser, @Param("templateId") templateId: string, @Param("versionId") versionId: string,
                       @Body(new ZodValidationPipe(checklistDraftPatchSchema)) dto: ChecklistDraftPatch) {
    return this.checklists.patchTemplateVersion(u, templateId, versionId, dto);
  }

  @Post("admin/inspection-templates/:templateId/versions/:versionId/publish")
  publishTemplateVersion(@CurrentUser() u: AbilityUser, @Param("templateId") templateId: string, @Param("versionId") versionId: string) {
    return this.checklists.publishTemplateVersion(u, templateId, versionId);
  }
}
