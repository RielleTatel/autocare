import { Injectable } from "@nestjs/common";
import { RedisService } from "../../common/redis/redis.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainError } from "../../common/errors/domain-error";
import { addMinutesHHMM, dateOf, hhmmOf, toIso } from "./time";

const HOLD_TTL_SECONDS = 600; // FR-043: 10-minute hold

export type HoldValue = { userId: string; serviceTypeId: string; endIso: string };
export type ActiveHold = { bayId: string; start: string; end: string; date: string }; // start/end HH:mm

/** Redis key for a hold on a specific bay+start instant. */
const holdKey = (bayId: string, startIso: string) => `hold:${bayId}:${startIso}`;

/** Opaque hold id handed back to clients and later converted into an appointment. */
const holdId = (bayId: string, startIso: string) => `${bayId}|${startIso}`;
const parseHoldId = (id: string): { bayId: string; startIso: string } => {
  const sep = id.indexOf("|");
  if (sep < 0) throw new DomainError("SLOT_UNAVAILABLE", "malformed hold id", 400);
  return { bayId: id.slice(0, sep), startIso: id.slice(sep + 1) };
};

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
    const value: HoldValue = { userId, serviceTypeId, endIso };

    const reply = await this.redis.client.set(
      holdKey(bayId, startIso),
      JSON.stringify(value),
      "EX",
      HOLD_TTL_SECONDS,
      "NX",
    );
    if (reply === null) throw new DomainError("SLOT_UNAVAILABLE", "slot already held", 409);
    return { holdId: holdId(bayId, startIso) };
  }

  /** Releases a hold the caller owns. No-op if it already expired. */
  async release(id: string, userId: string): Promise<{ released: boolean }> {
    const { bayId, startIso } = parseHoldId(id);
    const key = holdKey(bayId, startIso);
    const raw = await this.redis.client.get(key);
    if (raw === null) return { released: false };
    const val = JSON.parse(raw) as HoldValue;
    if (val.userId !== userId) throw new DomainError("FORBIDDEN_ROLE", "not your hold", 403);
    await this.redis.client.del(key);
    return { released: true };
  }

  /**
   * Reads a hold's stored details without deleting it — used by the booking transaction to confirm
   * the hold still exists, belongs to the caller, and to recover its end time / service type.
   */
  async peek(id: string, userId: string): Promise<{ bayId: string; startIso: string } & HoldValue> {
    const { bayId, startIso } = parseHoldId(id);
    const raw = await this.redis.client.get(holdKey(bayId, startIso));
    if (raw === null) throw new DomainError("SLOT_UNAVAILABLE", "hold expired", 409);
    const val = JSON.parse(raw) as HoldValue;
    if (val.userId !== userId) throw new DomainError("FORBIDDEN_ROLE", "not your hold", 403);
    return { bayId, startIso, ...val };
  }

  /** Deletes a hold key by id (called after a successful booking conversion). */
  async consume(id: string): Promise<void> {
    const { bayId, startIso } = parseHoldId(id);
    await this.redis.client.del(holdKey(bayId, startIso));
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
        const val = JSON.parse(raw) as HoldValue;
        out.push({ bayId, start: hhmmOf(startIso), end: hhmmOf(val.endIso), date });
      });
    } while (cursor !== "0");
    return out;
  }
}
