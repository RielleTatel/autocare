import { Body, Controller, Get, Headers, Param, Patch, Post, Res } from "@nestjs/common";
type Response = {
  setHeader(name: string, value: string): void;
  status(code: number): { end(): void };
  json(body: unknown): void;
};
import { checklistDraftPatchSchema, previewScoreSchema, ChecklistDraftPatch, PreviewScoreInput } from "@autocare/contracts";
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
}
