import { Controller, Get, Post, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { CurrentUser } from "./current-user.decorator";

interface BearerRequest {
  headers: { authorization?: string };
}

@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("auth/session")
  session(@Req() req: BearerRequest) {
    return this.auth.createSession(req.headers.authorization);
  }

  // Minimal protected route to prove the guard; moves to UsersModule in Phase 1.
  @Get("users/me")
  me(@CurrentUser() user: unknown) {
    return user;
  }
}
