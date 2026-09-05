import { Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AbilityUser } from "../../common/policies/ability.factory";
import { PrismaService } from "../prisma/prisma.service";
import { AnnouncementsService } from "./announcements.service";

@Controller()
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService, private prisma: PrismaService) {}

  /** The caller's own threads plus live broadcasts, newest first. */
  @Get("me/announcements")
  async mine(@CurrentUser() u: AbilityUser) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ownerUserId: u.id, status: "ACTIVE" },
      select: { id: true, plateNo: true },
    });
    // Plates only disambiguate when there is more than one vehicle — otherwise noise (FR-110).
    const plates = vehicles.length > 1 ? new Map(vehicles.map((v) => [v.id, v.plateNo])) : new Map<string, string>();
    return this.announcements.feed(u.id, plates);
  }

  @Post("announcements/:id/read")
  async read(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    await this.announcements.markRead(u.id, id);
    return { ok: true };
  }

  @Post("announcements/read-all")
  async readAll(@CurrentUser() u: AbilityUser) {
    await this.announcements.markAllRead(u.id);
    return { ok: true };
  }

  @Post("announcements/:id/dismiss")
  async dismiss(@CurrentUser() u: AbilityUser, @Param("id") id: string) {
    await this.announcements.dismiss(u.id, id);
    return { ok: true };
  }
}
