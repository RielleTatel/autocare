import { Injectable } from "@nestjs/common";
import { RedisService } from "../../common/redis/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { addMinutesHHMM, dateOf, hhmmOf, toIso } from "./time";

const HOLD_TTL_SECONDS = 600; // FR-043: 10-minute hold

export type HoldDetails = { bayId: string; startIso: string; userId: string; serviceTypeId: string; endIso: string };
export type ActiveHold = { bayId: string; start: string; end: string; date: string }; // start/end HH:mm

/** Redis key for a hold on a specific bay+start instant. */
const holdKey = (bayId: string, startIso: string) => `hold:${bayId}:${startIso}`;

// Value is a pipe-delimited `userId|serviceTypeId|endIso`. Pipe-delimited (not JSON) so the atomic
// claim script can ownership-check with a cheap prefix comparison. userId/serviceTypeId are uuids
// and endIso has no pipes, so a 3-way split is unambiguous.
const encodeValue = (userId: string, serviceTypeId: string, endIso: string) => `${userId}|${serviceTypeId}|${endIso}`;
const decodeValue = (raw: string): { userId: string; serviceTypeId: string; endIso: string } => {
  const [userId, serviceTypeId, endIso] = raw.split("|");
  return { userId, serviceTypeId, endIso };
};

/** Opaque hold id handed to clients and later converted into an appointment. */
const holdIdOf = (bayId: string, startIso: string) => `${bayId}|${startIso}`;
const parseHoldId = (id: string): { bayId: string; startIso: string } => {
  const sep = id.indexOf("|");
  if (sep < 0) throw new DomainError("SLOT_UNAVAILABLE", "malformed hold id", 400);
  return { bayId: id.slice(0, sep), startIso: id.slice(sep + 1) };
};

// Atomically GET+DEL a hold only if the caller owns it (value starts with `userId|`). Returns the
// value on success, false if the key is missing OR owned by someone else (hold left intact then).
// This is the booking mutex: two racing bookings on one hold — only one DEL wins.
const CLAIM_LUA = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
if string.sub(v, 1, string.len(ARGV[1])) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return v
end
return false`;

@Injectable()
export class HoldsService {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  /**
   * Reserves a slot for 10 minutes. `SET key value NX EX 600` is atomic, so two racing callers on
   * the same slot can never both succeed — the loser gets a `null` reply and a 409.
   */
  async acquire(bayId: string, startIso: string, serviceTypeId: string, userId: string): Promise<{ holdId: string }> {
    const st = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { standardDurationMin: true },
    });
    if (!st) throw new DomainError("SLOT_UNAVAILABLE", "unknown service type", 400);

    const endIso = toIso(dateOf(startIso), addMinutesHHMM(hhmmOf(startIso), st.standardDurationMin));
    const reply = await this.redis.client.set(
      holdKey(bayId, startIso),
      encodeValue(userId, serviceTypeId, endIso),
      "EX",
      HOLD_TTL_SECONDS,
      "NX",
    );
    if (reply === null) throw new DomainError("SLOT_UNAVAILABLE", "slot already held", 409);
    return { holdId: holdIdOf(bayId, startIso) };
  }

  /** Releases a hold the caller owns. No-op if it already expired. */
  async release(id: string, userId: string): Promise<{ released: boolean }> {
    const { bayId, startIso } = parseHoldId(id);
    const key = holdKey(bayId, startIso);
    const raw = await this.redis.client.get(key);
    if (raw === null) return { released: false };
    if (decodeValue(raw).userId !== userId) throw new DomainError("FORBIDDEN_ROLE", "not your hold", 403);
    await this.redis.client.del(key);
    return { released: true };
  }

  /**
   * Atomically claims (consumes) a hold the caller owns — the booking mutex. Throws
   * SLOT_UNAVAILABLE if the hold is gone (expired or already booked) or owned by someone else.
   */
  async claim(id: string, userId: string): Promise<HoldDetails> {
    const { bayId, startIso } = parseHoldId(id);
    const raw = (await this.redis.client.eval(CLAIM_LUA, 1, holdKey(bayId, startIso), `${userId}|`)) as string | null;
    if (raw === null || raw === undefined) throw new DomainError("SLOT_UNAVAILABLE", "hold expired or already used", 409);
    const { serviceTypeId, endIso } = decodeValue(raw);
    return { bayId, startIso, userId, serviceTypeId, endIso };
  }

  /** Re-creates a hold (compensation) if a booking that already claimed it later rolls back. */
  async restore(details: HoldDetails): Promise<void> {
    await this.redis.client.set(
      holdKey(details.bayId, details.startIso),
      encodeValue(details.userId, details.serviceTypeId, details.endIso),
      "EX",
      HOLD_TTL_SECONDS,
      "NX",
    );
  }

  /**
   * All live holds whose start falls on any date in `dates`, shaped for the capacity engine. Uses
   * SCAN (not KEYS) so it never blocks Redis. Batched across the whole query window by the caller.
   */
  async activeHoldsForDates(dates: string[]): Promise<ActiveHold[]> {
    const wanted = new Set(dates);
    const out: ActiveHold[] = [];
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.client.scan(cursor, "MATCH", "hold:*", "COUNT", 200);
      cursor = next;
      if (keys.length === 0) continue;
      const values = await this.redis.client.mget(...keys);
      keys.forEach((key, idx) => {
        // key = hold:{bayId}:{startIso}. bayId is a uuid (no colons); startIso contains colons, so
        // split off the first two segments and rejoin the rest.
        const firstColon = key.indexOf(":");
        const secondColon = key.indexOf(":", firstColon + 1);
        const bayId = key.slice(firstColon + 1, secondColon);
        const startIso = key.slice(secondColon + 1);
        const date = dateOf(startIso);
        if (!wanted.has(date)) return;
        const raw = values[idx];
        if (raw === null) return;
        out.push({ bayId, start: hhmmOf(startIso), end: hhmmOf(decodeValue(raw).endIso), date });
      });
    } while (cursor !== "0");
    return out;
  }
}
