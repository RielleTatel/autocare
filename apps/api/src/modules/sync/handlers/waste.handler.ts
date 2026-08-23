import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { DomainError } from "../../../common/errors/domain-error";
import { AbilityUser } from "../../../common/policies/ability.factory";
import { SyncEntityHandler, SyncTx } from "../sync.types";
import type { SyncItemInput } from "@autocare/contracts";

const wastePayloadSchema = z.object({
  workOrderId: z.string().uuid(),
  wasteType: z.enum(["USED_OIL", "BATTERY", "FILTER", "TIRE", "COOLANT"]),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(16),
  haulerName: z.string().max(200).optional(),
  manifestNo: z.string().max(120).optional(),
});

/** Offline waste records captured on the field app (F-10) drain through
 *  /sync/batch as entityType "waste_record". Idempotent via the outbox
 *  clientUuid, mirroring the inspection handler. */
@Injectable()
export class WasteSyncHandler implements SyncEntityHandler {
  readonly entityType = "waste_record" as const;

  async apply(tx: SyncTx, user: AbilityUser, item: SyncItemInput): Promise<void> {
    if (!["MECHANIC", "ADVISOR", "ADMIN"].includes(user.role)) {
      throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
    }
    const parsed = wastePayloadSchema.safeParse(item.payload);
    if (!parsed.success) throw new DomainError("INSPECTION_INCOMPLETE", "invalid waste payload", 422);
    const p = parsed.data;

    const wo = await tx.workOrder.findUnique({ where: { id: p.workOrderId } });
    if (!wo) throw new DomainError("WORK_ORDER_NOT_FOUND", "work order not found", 404);
    if (["CLOSED", "CANCELLED"].includes(wo.status)) throw new DomainError("WORK_ORDER_IMMUTABLE", "work order is closed", 409);

    // clientUuid is the outbox entry id; dedupe on it.
    const existing = await tx.wasteRecord.findUnique({ where: { clientUuid: item.clientUuid } });
    if (existing) return;
    await tx.wasteRecord.create({
      data: {
        clientUuid: item.clientUuid,
        workOrderId: p.workOrderId,
        wasteType: p.wasteType,
        quantity: p.quantity,
        unit: p.unit,
        haulerName: p.haulerName ?? null,
        manifestNo: p.manifestNo ?? null,
      },
    });
  }
}
