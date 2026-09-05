import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { broadcastCreateSchema, type BroadcastCreate } from "@autocare/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { DomainError } from "../../common/errors/domain-error";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AnnouncementsService } from "./announcements.service";

/**
 * A-16 — FR-107 broadcast console. Role is enforced here rather than by a guard, matching the
 * house convention (see utilisation.service.ts's forWindowForUser).
 */
@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  private assertAdmin(u: AbilityUser): void {
    if (u.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "admin only", 403);
  }

  /** Broadcasts to every member. Audience segmentation is deferred (design spec §12). */
  @Post()
  async create(
    @CurrentUser() u: AbilityUser,
    @Body(new ZodValidationPipe(broadcastCreateSchema)) dto: BroadcastCreate,
  ) {
    this.assertAdmin(u);
    await this.announcements.broadcast(u.id, dto);
    return { ok: true };
  }

  @Get()
  list(@CurrentUser() u: AbilityUser) {
    this.assertAdmin(u);
    return this.announcements.listBroadcasts();
  }

  @Patch(":id")
  async unpublish(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    this.assertAdmin(u);
    await this.announcements.unpublish(id);
    return { ok: true };
  }
}
