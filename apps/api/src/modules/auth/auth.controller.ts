import { Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";

interface BearerRequest {
  headers: { authorization?: string };
}

@Controller()
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("auth/session")
  session(@Req() req: BearerRequest) {
    return this.auth.createSession(req.headers.authorization);
  }
}
