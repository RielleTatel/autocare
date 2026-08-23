import type { Prisma } from "@prisma/client";
import type { SyncItemInput } from "@autocare/contracts";
import type { AbilityUser } from "../../common/policies/ability.factory";

export type SyncTx = Prisma.TransactionClient;

/** One handler per entityType. Phase 5/6 register theirs in SyncModule without
 *  touching sync core. Throw DomainError to reject the item. */
export interface SyncEntityHandler {
  readonly entityType: SyncItemInput["entityType"];
  apply(tx: SyncTx, user: AbilityUser, item: SyncItemInput): Promise<void>;
}

export const SYNC_HANDLERS = Symbol("SYNC_HANDLERS");
