import { Controller, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";

interface BearerRequest {
  headers: { authorization?: string };
}

/**
 * 30/min, not the 5/min used on credential endpoints.
 *
 * `POST auth/session` does not check a credential — Firebase has already
 * verified the password and issued the ID token, and this only exchanges that
 * token for a session. An attacker cannot guess a valid ID token, so the
 * brute-force limit that suits a login form is miscalibrated here.
 *
 * It is also the normal boot path of every client, and the throttler keys on
 * IP: the member app, the field app and the staff console behind one office or
 * carrier NAT share a single budget, and every app relaunch spends from it. At
 * 5/min that tripped in ordinary use and surfaced as "Too many requests".
 * The cap still bounds hammering of the Firebase verify + user upsert.
 */
@Controller()
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post("auth/session")
  session(@Req() req: BearerRequest) {
    return this.auth.createSession(req.headers.authorization);
  }
}
