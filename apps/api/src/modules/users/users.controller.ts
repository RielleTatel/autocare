import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { profileUpdateSchema, userStatusUpdateSchema, ProfileUpdate, UserStatusUpdate } from "@autocare/contracts";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CheckPolicy } from "../../common/policies/check-policy.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private users: UsersService) {}

  @Get("me")
  me(@CurrentUser() u: { id: string }) {
    return this.users.me(u.id);
  }

  @Patch("me")
  updateMe(@CurrentUser() u: { id: string }, @Body(new ZodValidationPipe(profileUpdateSchema)) dto: ProfileUpdate) {
    return this.users.updateMe(u.id, dto);
  }

  @Post("me/data-export")
  dataExport(@CurrentUser() u: { id: string }) {
    return this.users.createDataRequest(u.id, "EXPORT");
  }

  @Post("me/deletion-request")
  deletionRequest(@CurrentUser() u: { id: string }) {
    return this.users.createDataRequest(u.id, "ERASURE");
  }

  @Patch(":id/status")
  @CheckPolicy((a) => a.can("update", "User"))
  setStatus(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(userStatusUpdateSchema)) dto: UserStatusUpdate,
  ) {
    return this.users.setStatus(u.id, id, dto);
  }
}
