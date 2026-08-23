import { Inject, Injectable } from "@nestjs/common";
import type { SyncBatchInput, SyncBatchResponse, SyncItemResult } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { SYNC_HANDLERS, SyncEntityHandler } from "./sync.types";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

@Injectable()
export class SyncService {
  private handlers: Map<string, SyncEntityHandler>;

  constructor(
    private prisma: PrismaService,
    @Inject(SYNC_HANDLERS) handlers: SyncEntityHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.entityType, h]));
  }

  private assertStaff(u: AbilityUser): void {
    if (!STAFF_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }

  /** Per-item transactions — partial success is the contract; one bad item
   *  never rolls back its batch-mates. Receipts are written inside the same
   *  transaction as the item's rows, so a crash can't apply without receipt. */
  async batch(u: AbilityUser, dto: SyncBatchInput): Promise<SyncBatchResponse> {
    this.assertStaff(u);
    const results: SyncItemResult[] = [];
    for (const item of dto.items) {
      const existing = await this.prisma.syncOutboxReceipt.findUnique({ where: { clientUuid: item.clientUuid } });
      if (existing && existing.status !== "REJECTED") {
        results.push({ clientUuid: item.clientUuid, status: "DUPLICATE" });
        continue;
      }
      const handler = this.handlers.get(item.entityType);
      if (!handler) {
        results.push({ clientUuid: item.clientUuid, status: "REJECTED", error: { code: "SYNC_UNSUPPORTED_ENTITY", message: `no handler for entityType ${item.entityType}` } });
        continue;
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await handler.apply(tx, u, item);
          const receipt = { userId: u.id, entityType: item.entityType, op: item.op, status: "APPLIED" as const, errorCode: null };
          if (existing) await tx.syncOutboxReceipt.update({ where: { clientUuid: item.clientUuid }, data: receipt });
          else await tx.syncOutboxReceipt.create({ data: { clientUuid: item.clientUuid, ...receipt } });
        });
        results.push({ clientUuid: item.clientUuid, status: "APPLIED" });
      } catch (err) {
        const code = err instanceof DomainError ? err.code : "INTERNAL";
        const message = err instanceof Error ? err.message : String(err);
        // Rejected receipt is recorded for audit but a corrected replay re-attempts.
        const receipt = { userId: u.id, entityType: item.entityType, op: item.op, status: "REJECTED" as const, errorCode: code };
        if (existing) await this.prisma.syncOutboxReceipt.update({ where: { clientUuid: item.clientUuid }, data: receipt }).catch(() => undefined);
        else await this.prisma.syncOutboxReceipt.create({ data: { clientUuid: item.clientUuid, ...receipt } }).catch(() => undefined);
        results.push({ clientUuid: item.clientUuid, status: "REJECTED", error: { code, message } });
      }
    }
    return { results };
  }

  async status(u: AbilityUser) {
    this.assertStaff(u);
    const [receiptCount, last] = await Promise.all([
      this.prisma.syncOutboxReceipt.count({ where: { userId: u.id } }),
      this.prisma.syncOutboxReceipt.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    ]);
    return { receiptCount, lastReceiptAt: last?.createdAt ?? null };
  }
}
