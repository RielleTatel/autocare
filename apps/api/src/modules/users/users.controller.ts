import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  profileUpdateSchema, userStatusUpdateSchema, userRoleUpdateSchema, staffQuerySchema,
  ProfileUpdate, UserStatusUpdate, UserRoleUpdate, StaffQuery,
} from "@autocare/contracts";
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

  /** Admin-only directory. Gated on the same ability as status changes —
   *  `can("update","User")` is granted by `manage all`, i.e. ADMIN alone. */
  @Get("staff")
  @CheckPolicy((a) => a.can("update", "User"))
  staff(@Query(new ZodValidationPipe(staffQuerySchema)) q: StaffQuery) {
    return this.users.staffDirectory(q);
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

  /** The only way into (or out of) a staff role — sign-up always creates a
   *  MEMBER, so this is how a mechanic is added or removed. */
  @Patch(":id/role")
  @CheckPolicy((a) => a.can("update", "User"))
  setRole(
    @CurrentUser() u: { id: string },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(userRoleUpdateSchema)) dto: UserRoleUpdate,
  ) {
    return this.users.setRole(u.id, id, dto);
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
