import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AddWasteInput, AddWorkOrderItemInput, CreateWorkOrderInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { AbilityUser } from "../../common/policies/ability.factory";
import { WorkOrderConfigService } from "./config.service";
import { WorkOrderEvents } from "./work-order-events";
import {
  approvedTotal, canTransition, ItemApproval, ItemType, WoItem, WoStatus,
} from "./lifecycle";

const STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);

type WoWithItems = Prisma.WorkOrderGetPayload<{ include: { items: true; wasteRecords: true } }>;

@Injectable()
export class WorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private config: WorkOrderConfigService,
    private audit: AuditService,
    private events: WorkOrderEvents,
  ) {}

  private assertStaff(u: AbilityUser): void {
    if (!STAFF_ROLES.has(u.role)) throw new DomainError("FORBIDDEN_ROLE", "staff only", 403);
  }

  private toWoItems(wo: WoWithItems): WoItem[] {
    // partCategory is needed for waste rules; look it up per part line lazily elsewhere.
    return wo.items.map((i) => ({
      type: i.type as ItemType,
      qty: i.qty,
      unitPriceCentavos: Number(i.unitPriceCentavos),
      discountCentavos: Number(i.discountCentavos),
      approvalStatus: i.approvalStatus as ItemApproval,
      done: i.done,
      partCategory: undefined, // filled by withPartCategories when needed
    }));
  }

  private async withPartCategories(wo: WoWithItems): Promise<WoItem[]> {
    const skus = wo.items.filter((i) => i.partSku).map((i) => i.partSku!) as string[];
    const parts = skus.length ? await this.prisma.part.findMany({ where: { sku: { in: skus } } }) : [];
    const catBySku = new Map(parts.map((p) => [p.sku, p.category]));
    return wo.items.map((i) => ({
      type: i.type as ItemType,
      qty: i.qty,
      unitPriceCentavos: Number(i.unitPriceCentavos),
      discountCentavos: Number(i.discountCentavos),
      approvalStatus: i.approvalStatus as ItemApproval,
      done: i.done,
      partCategory: i.partSku ? catBySku.get(i.partSku) ?? null : null,
    }));
  }

  private async loadOrThrow(id: string): Promise<WoWithItems> {
    const wo = await this.prisma.workOrder.findUnique({ where: { id }, include: { items: true, wasteRecords: true } });
    if (!wo) throw new DomainError("WORK_ORDER_NOT_FOUND", "work order not found", 404);
    return wo;
  }

  async create(u: AbilityUser, dto: CreateWorkOrderInput) {
    this.assertStaff(u);
    const number = await withNumberRetry(() => this.prisma.$transaction((tx) => this.createIn(tx, u, dto)));
    this.events.emitChanged(number.vehicleId);
    return number;
  }

  private async createIn(tx: Prisma.TransactionClient, u: AbilityUser, dto: CreateWorkOrderInput) {
    const number = await nextWorkOrderNumber(tx);
    return tx.workOrder.create({
      data: {
        number,
        vehicleId: dto.vehicleId,
        appointmentId: dto.appointmentId ?? null,
        inspectionId: dto.inspectionId ?? null,
        customerComplaint: dto.customerComplaint ?? null,
        advisorUserId: u.id,
      },
      include: { items: true, wasteRecords: true },
    });
  }

  /** Work orders for a vehicle (member reads own; staff read any). Used by the
   *  member M-17 service history and to locate a pending-approval work order. */
  async listForVehicle(u: AbilityUser, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new DomainError("WORK_ORDER_NOT_FOUND", "vehicle not found", 404);
    if (!STAFF_ROLES.has(u.role)) {
      const owns = vehicle.ownerUserId === u.id || (u.orgId != null && vehicle.orgOwnerId === u.orgId);
      if (!owns) throw new DomainError("FORBIDDEN_ROLE", "not your vehicle", 403);
    }
    const wos = await this.prisma.workOrder.findMany({
      where: { vehicleId },
      orderBy: { openedAt: "desc" },
      include: { items: { include: { part: true, recommendation: true } }, wasteRecords: true, vehicle: true },
    });
    return wos.map((w) => this.present(w));
  }

  async get(u: AbilityUser, id: string) {
    // Members may read their own vehicle's work orders (for the approval flow).
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { items: { include: { part: true, recommendation: true } }, wasteRecords: true, vehicle: true },
    });
    if (!wo) throw new DomainError("WORK_ORDER_NOT_FOUND", "work order not found", 404);
    if (!STAFF_ROLES.has(u.role)) {
      const ownsDirect = wo.vehicle.ownerUserId === u.id;
      const ownsOrg = u.orgId != null && wo.vehicle.orgOwnerId === u.orgId;
      if (!ownsDirect && !ownsOrg) throw new DomainError("FORBIDDEN_ROLE", "not your work order", 403);
    }
    return this.present(wo);
  }

  private present(wo: any) {
    return {
      id: wo.id,
      number: wo.number,
      vehicleId: wo.vehicleId,
      plateNo: wo.vehicle?.plateNo,
      status: wo.status,
      customerComplaint: wo.customerComplaint,
      technicianSummary: wo.technicianSummary,
      openedAt: wo.openedAt,
      closedAt: wo.closedAt,
      items: (wo.items ?? []).map((i: any) => ({
        id: i.id,
        type: i.type,
        partSku: i.partSku,
        partName: i.part?.name ?? null,
        stockQty: i.part?.stockQty ?? null,
        description: i.description,
        qty: i.qty,
        unitPriceCentavos: Number(i.unitPriceCentavos),
        discountCentavos: Number(i.discountCentavos),
        lineTotalCentavos: Math.max(0, i.qty * Number(i.unitPriceCentavos) - Number(i.discountCentavos)),
        approvalStatus: i.approvalStatus,
        recommendationId: i.recommendationId,
        recommendationLabel: i.recommendation?.label ?? null,
        severity: i.recommendation?.severity ?? null,
        done: i.done,
      })),
      wasteRecords: (wo.wasteRecords ?? []).map((w: any) => ({
        id: w.id, wasteType: w.wasteType, quantity: w.quantity, unit: w.unit, haulerName: w.haulerName, manifestNo: w.manifestNo,
      })),
      totals: this.totals(wo.items ?? []),
    };
  }

  private totals(items: any[]) {
    const line = (i: any) => Math.max(0, i.qty * Number(i.unitPriceCentavos) - Number(i.discountCentavos));
    const parts = items.filter((i) => i.type === "PART").reduce((s, i) => s + line(i), 0);
    const labor = items.filter((i) => i.type === "LABOR").reduce((s, i) => s + line(i), 0);
    const discount = items.reduce((s, i) => s + Number(i.discountCentavos), 0);
    const approved = items.filter((i) => i.approvalStatus === "APPROVED").reduce((s, i) => s + line(i), 0);
    return { partsCentavos: parts, laborCentavos: labor, discountCentavos: discount, approvedCentavos: approved, grandTotalCentavos: parts + labor };
  }

  async addItem(u: AbilityUser, id: string, dto: AddWorkOrderItemInput) {
    this.assertStaff(u);
    const wo = await this.loadOrThrow(id);
    if (["CLOSED", "CANCELLED"].includes(wo.status)) throw new DomainError("WORK_ORDER_IMMUTABLE", "cannot edit a closed/cancelled work order", 409);

    let unitPrice = dto.unitPriceCentavos;
    if (dto.type === "PART" && dto.partSku) {
      const part = await this.prisma.part.findUnique({ where: { sku: dto.partSku } });
      if (!part) throw new DomainError("ITEM_NOT_FOUND", `unknown part ${dto.partSku}`, 404);
      if (dto.unitPriceCentavos === 0) unitPrice = Number(part.priceCentavos);
    }

    const item = await this.prisma.workOrderItem.create({
      data: {
        workOrderId: id,
        type: dto.type,
        partSku: dto.type === "PART" ? dto.partSku ?? null : null,
        description: dto.description,
        qty: dto.qty,
        unitPriceCentavos: BigInt(unitPrice),
        discountCentavos: BigInt(dto.discountCentavos),
        recommendationId: dto.recommendationId ?? null,
      },
    });
    if (dto.recommendationId) {
      await this.prisma.recommendation.update({ where: { id: dto.recommendationId }, data: { status: "QUOTED" } });
    }
    return this.get(u, id).then((w) => ({ ...w, addedItemId: item.id }));
  }

  async markItemDone(u: AbilityUser, id: string, itemId: string, done: boolean) {
    this.assertStaff(u);
    const item = await this.prisma.workOrderItem.findFirst({ where: { id: itemId, workOrderId: id } });
    if (!item) throw new DomainError("ITEM_NOT_FOUND", "item not found", 404);
    await this.prisma.workOrderItem.update({ where: { id: itemId }, data: { done } });
    return this.get(u, id);
  }

  async requestApproval(u: AbilityUser, id: string) {
    this.assertStaff(u);
    const wo = await this.loadOrThrow(id);
    const threshold = await this.config.approvalThresholdCentavos();
    const err = canTransition(wo.status as WoStatus, "AWAITING_APPROVAL", { items: this.toWoItems(wo), thresholdCentavos: threshold });
    if (err) throw transitionError(err);
    await this.prisma.workOrder.update({ where: { id }, data: { status: "AWAITING_APPROVAL" } });
    this.events.emitApprovalRequired(wo.vehicleId, id);
    this.events.emitChanged(wo.vehicleId);
    return this.get(u, id);
  }

  /** Member decides one or many lines atomically (own vehicle only). */
  async decide(u: AbilityUser, id: string, decisions: Array<{ itemId: string; decision: "APPROVED" | "DECLINED" | "DEFERRED" }>) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id }, include: { items: true, vehicle: true } });
    if (!wo) throw new DomainError("WORK_ORDER_NOT_FOUND", "work order not found", 404);
    const ownsDirect = wo.vehicle.ownerUserId === u.id;
    const ownsOrg = u.orgId != null && wo.vehicle.orgOwnerId === u.orgId;
    if (!ownsDirect && !ownsOrg) throw new DomainError("FORBIDDEN_ROLE", "not your work order", 403);

    await this.prisma.$transaction(async (tx) => {
      for (const d of decisions) {
        const item = wo.items.find((i) => i.id === d.itemId);
        if (!item) throw new DomainError("ITEM_NOT_FOUND", `item ${d.itemId} not on this work order`, 404);
        await tx.workOrderItem.update({
          where: { id: d.itemId },
          data: { approvalStatus: d.decision, approvedAt: d.decision === "APPROVED" ? new Date() : null },
        });
        if (item.recommendationId) {
          // DEFERRED behaves as declined now but keeps the recommendation deferred (FR-069).
          const recStatus = d.decision === "APPROVED" ? "APPROVED" : d.decision === "DEFERRED" ? "DEFERRED" : "DECLINED";
          await tx.recommendation.update({ where: { id: item.recommendationId }, data: { status: recStatus } });
        }
      }
    });
    // exactly one changed event per request, not per line (FR-112)
    this.events.emitChanged(wo.vehicleId);
    this.events.emitAttentionChanged(wo.vehicle.ownerUserId ?? undefined);
    return this.get(u, id);
  }

  async addWaste(u: AbilityUser, id: string, dto: AddWasteInput) {
    this.assertStaff(u);
    const wo = await this.loadOrThrow(id);
    if (["CLOSED", "CANCELLED"].includes(wo.status)) throw new DomainError("WORK_ORDER_IMMUTABLE", "cannot add waste to a closed work order", 409);
    if (dto.clientUuid) {
      const existing = await this.prisma.wasteRecord.findUnique({ where: { clientUuid: dto.clientUuid } });
      if (existing) return this.get(u, id); // idempotent offline replay
    }
    await this.prisma.wasteRecord.create({
      data: {
        workOrderId: id, clientUuid: dto.clientUuid ?? null, wasteType: dto.wasteType,
        quantity: dto.quantity, unit: dto.unit, haulerName: dto.haulerName ?? null, manifestNo: dto.manifestNo ?? null,
      },
    });
    return this.get(u, id);
  }

  /** Advance the lifecycle. Closure runs stock + billing side effects (Tasks 6/8). */
  async updateStatus(u: AbilityUser, id: string, to: WoStatus, opts: { technicianSummary?: string; stockOverrideReason?: string }) {
    this.assertStaff(u);
    const wo = await this.loadOrThrow(id);
    const threshold = await this.config.approvalThresholdCentavos();
    const summary = opts.technicianSummary ?? wo.technicianSummary ?? undefined;
    const items = await this.withPartCategories(wo);
    const recordedWasteTypes = wo.wasteRecords.map((w) => w.wasteType);

    const err = canTransition(wo.status as WoStatus, to, { items, thresholdCentavos: threshold, technicianSummary: summary, recordedWasteTypes });
    if (err) throw transitionError(err);

    if (to === "CLOSED") {
      await this.close(u, wo, summary!, opts.stockOverrideReason);
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: { status: to, technicianSummary: opts.technicianSummary ?? undefined },
      });
    }
    this.events.emitChanged(wo.vehicleId);
    return this.get(u, id);
  }

  private async close(u: AbilityUser, wo: WoWithItems, summary: string, stockOverrideReason?: string) {
    const approvedParts = wo.items.filter((i) => i.approvalStatus === "APPROVED" && i.type === "PART" && i.partSku);
    // Stock check (FR-072): decrement on closure; negative only with override.
    if (!stockOverrideReason) {
      for (const i of approvedParts) {
        const part = await this.prisma.part.findUnique({ where: { sku: i.partSku! } });
        if (part && part.stockQty - i.qty < 0) {
          throw new DomainError("STOCK_INSUFFICIENT", `insufficient stock for ${i.partSku} (have ${part.stockQty}, need ${i.qty})`, 409, { sku: i.partSku, have: part.stockQty, need: i.qty });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const i of approvedParts) {
        await tx.part.update({ where: { sku: i.partSku! }, data: { stockQty: { decrement: i.qty } } });
      }
      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          status: "CLOSED",
          technicianSummary: summary,
          closedAt: new Date(),
          stockOverride: Boolean(stockOverrideReason),
          stockOverrideReason: stockOverrideReason ?? null,
        },
      });
      // Resolve any approved recommendations tied to this WO (attention clears).
      const recIds = wo.items.filter((i) => i.recommendationId && i.approvalStatus === "APPROVED").map((i) => i.recommendationId!) as string[];
      if (recIds.length) await tx.recommendation.updateMany({ where: { id: { in: recIds } }, data: { status: "RESOLVED" } });
    });

    if (stockOverrideReason) {
      await this.audit.record(u.id, "STOCK_NEGATIVE_OVERRIDE", "WorkOrder", wo.id, null, { reason: stockOverrideReason });
    }

    // Billing hook (Task 8) is invoked by the controller layer after close so the
    // billing module dependency does not couple into the core service. See
    // WorkOrderBillingService.issueForClosedWorkOrder.
    const owner = await this.prisma.vehicle.findUnique({ where: { id: wo.vehicleId }, select: { ownerUserId: true } });
    this.events.emitAttentionChanged(owner?.ownerUserId ?? undefined);
  }

  approvedBillableCentavos(items: { approvalStatus: string; qty: number; unitPriceCentavos: bigint; discountCentavos: bigint }[]): number {
    return approvedTotal(items.map((i) => ({
      type: "PART", qty: i.qty, unitPriceCentavos: Number(i.unitPriceCentavos), discountCentavos: Number(i.discountCentavos),
      approvalStatus: i.approvalStatus as ItemApproval, done: true,
    })));
  }
}

function transitionError(err: NonNullable<ReturnType<typeof canTransition>>): DomainError {
  switch (err.code) {
    case "ILLEGAL_TRANSITION": return new DomainError("ILLEGAL_TRANSITION", "that status change is not allowed", 409);
    case "APPROVAL_REQUIRED": return new DomainError("APPROVAL_REQUIRED", "work order total exceeds the approval threshold; member approval required", 409);
    case "UNDECIDED_LINES": return new DomainError("UNDECIDED_LINES", "every line must be decided before approval", 409);
    case "APPROVED_WORK_INCOMPLETE": return new DomainError("APPROVED_WORK_INCOMPLETE", "all approved work must be marked done before closing", 409);
    case "SUMMARY_REQUIRED": return new DomainError("SUMMARY_REQUIRED", "a technician summary is required to close", 409);
    case "WASTE_REQUIRED": return new DomainError("WASTE_REQUIRED", `a ${err.wasteType} waste record is required before closing`, 409, { wasteType: err.wasteType });
  }
}

/** WO-YYYYMM-#### sequential within the month. Collisions retry (see withNumberRetry). */
export async function nextWorkOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `WO-${ym}-`;
  const count = await tx.workOrder.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

export async function withNumberRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!collision || i === attempts - 1) throw e;
    }
  }
  /* istanbul ignore next */
  throw new Error("unreachable");
}
