import { Injectable } from "@nestjs/common";
import { Prisma, SimpleRepairOperationAction } from "@prisma/client";
import type { SimpleRepairCompleteInput, SimpleRepairScheduleReturnInput, SimpleRepairStartInput, SimpleRepairStopInput, SimpleRepairUpdateInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { PrismaService } from "../prisma/prisma.service";
import { WorkOrderEvents } from "./work-order-events";
import { nextWorkOrderNumber, withNumberRetry } from "./work-orders.service";
import { HoldsService } from "../scheduling/holds.service";

const READ_STAFF_ROLES = new Set(["MECHANIC", "ADVISOR", "DRIVER", "ADMIN"]);
const repairInclude = {
  invoices: { select: { id: true, status: true, documentKind: true }, orderBy: { issuedAt: "desc" as const } },
  returnAppointment: { select: { id: true, scheduledStart: true, scheduledEnd: true, status: true, bayId: true, updatedAt: true } },
};
type RepairRecord = Prisma.WorkOrderGetPayload<{ include: typeof repairInclude }>;
type RepairDto = ReturnType<typeof presentRepair>;
type MemberRepairStatus = "IN_PROGRESS" | "AWAITING_ADMIN_REVIEW" | "RETURNED_FOR_CORRECTION" | "PAYMENT_DUE" | "PAID" | "STOPPED" | "NO_CHARGE";

/** The simple repair workflow has no structured items, quotations or owner decisions. */
@Injectable()
export class SimpleRepairsService {
  constructor(private prisma: PrismaService, private events: WorkOrderEvents, private holds: HoldsService) {}

  private assertCanMutate(u: AbilityUser): void {
    if (u.role !== "MECHANIC" && u.role !== "ADMIN") {
      throw new DomainError("FORBIDDEN_ROLE", "only mechanics and administrators can record repair work", 403);
    }
  }

  private assertCanRead(u: AbilityUser, vehicle: { ownerUserId: string | null; orgOwnerId: string | null }): void {
    if (READ_STAFF_ROLES.has(u.role)) return;
    if (vehicle.ownerUserId === u.id || (u.orgId != null && vehicle.orgOwnerId === u.orgId)) return;
    throw new DomainError("FORBIDDEN_ROLE", "not your repair work", 403);
  }

  async getForInspection(u: AbilityUser, inspectionId: string): Promise<RepairDto | null> {
    const inspection = await this.prisma.inspection.findUnique({ where: { id: inspectionId }, include: { vehicle: true } });
    if (!inspection) throw new DomainError("INSPECTION_INCOMPLETE", "inspection not found", 404);
    this.assertCanRead(u, inspection.vehicle);
    const repair = await this.prisma.workOrder.findFirst({ where: { inspectionId, simpleRepair: true }, include: repairInclude });
    return repair ? presentRepair(repair) : null;
  }

  async get(u: AbilityUser, id: string): Promise<RepairDto> {
    const repair = await this.prisma.workOrder.findFirst({ where: { id, simpleRepair: true }, include: { ...repairInclude, vehicle: true } });
    if (!repair) throw new DomainError("WORK_ORDER_NOT_FOUND", "repair work not found", 404);
    this.assertCanRead(u, repair.vehicle);
    return presentRepair(repair);
  }

  async listForVehicle(u: AbilityUser, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new DomainError("WORK_ORDER_NOT_FOUND", "vehicle not found", 404);
    this.assertCanRead(u, vehicle);
    const repairs = await this.prisma.workOrder.findMany({
      where: { vehicleId, simpleRepair: true },
      include: repairInclude,
      orderBy: { openedAt: "desc" },
    });
    return repairs.map((repair) => {
      const invoice = repair.invoices[0];
      const state: MemberRepairStatus = invoice?.documentKind === "NO_CHARGE" ? "NO_CHARGE"
        : invoice?.status === "PAID" ? "PAID"
          : invoice ? "PAYMENT_DUE"
            : repair.repairStatus === "IN_PROGRESS" ? "IN_PROGRESS"
              : repair.repairStatus === "RETURNED_FOR_CORRECTION" ? "RETURNED_FOR_CORRECTION"
                : repair.repairStatus === "STOPPED" ? "STOPPED" : "AWAITING_ADMIN_REVIEW";
      return {
        id: repair.id,
        vehicleId: repair.vehicleId,
        inspectionId: repair.inspectionId!,
        appointmentId: repair.appointmentId,
        number: repair.number,
        status: state,
        repairNotes: repair.repairNotes ?? "",
        estimatedTotalCentavos: Number(repair.estimatedRepairCentavos ?? 0n),
        openedAt: repair.openedAt.toISOString(),
        completedAt: repair.repairCompletedAt?.toISOString() ?? null,
        stoppedAt: repair.repairStoppedAt?.toISOString() ?? null,
        completionNotes: repair.repairCompletionNotes,
        stopReason: repair.repairStopReason,
        completedWorkNotes: repair.completedWorkNotes,
        recheckedAt: repair.repairRechecked && repair.repairCompletedAt ? repair.repairCompletedAt.toISOString() : null,
        returnScheduledStart: repair.returnAppointment?.status === "CANCELLED" ? null : repair.returnAppointment?.scheduledStart.toISOString() ?? null,
        returnAppointmentId: repair.returnAppointment?.status === "CANCELLED" ? null : repair.returnAppointment?.id ?? null,
        updatedAt: repair.returnAppointment && repair.returnAppointment.updatedAt > repair.updatedAt
          ? repair.returnAppointment.updatedAt.toISOString() : repair.updatedAt.toISOString(),
        invoiceId: invoice?.id ?? null,
      };
    });
  }

  async start(u: AbilityUser, inspectionId: string, dto: SimpleRepairStartInput): Promise<RepairDto> {
    this.assertCanMutate(u);
    const result = await withNumberRetry(() => this.prisma.$transaction(async (tx) => {
      // Resolve a lost-response retry before inspecting current eligibility or state.
      const replay = await tx.workOrder.findUnique({ where: { repairClientUuid: dto.clientUuid }, include: repairInclude });
      if (replay) {
        if (!replay.simpleRepair || replay.inspectionId !== inspectionId) throw operationConflict();
        return { repair: presentRepair(replay), changed: false };
      }

      // Serialize independent devices starting from the same accepted report.
      await tx.$queryRaw`SELECT id FROM inspections WHERE id = ${inspectionId}::uuid FOR UPDATE`;
      const inspection = await tx.inspection.findUnique({ where: { id: inspectionId } });
      if (!inspection) throw new DomainError("INSPECTION_INCOMPLETE", "inspection not found", 404);
      if (!inspection.submittedAt) throw new DomainError("INSPECTION_INCOMPLETE", "accept the inspection before starting repair work", 409);
      const origin = inspection.appointmentId
        ? await tx.appointment.findUnique({ where: { id: inspection.appointmentId }, select: { serviceTypeId: true, vehicleId: true } })
        : null;
      if (origin && origin.vehicleId !== inspection.vehicleId) throw new DomainError("INSPECTION_BOOKING_MISMATCH", "repair source appointment does not match the inspected vehicle", 409);
      const existing = await tx.workOrder.findFirst({ where: { inspectionId, simpleRepair: true }, include: repairInclude });
      if (existing) {
        if (existing.repairClientUuid === dto.clientUuid) return { repair: presentRepair(existing), changed: false };
        throw new DomainError("DUPLICATE_REQUEST", "this inspection already has repair work; open the existing job", 409, { workOrderId: existing.id });
      }
      const now = new Date();
      const repair = await tx.workOrder.create({
        data: {
          number: await nextWorkOrderNumber(tx), vehicleId: inspection.vehicleId,
          appointmentId: inspection.appointmentId, repairOriginServiceTypeId: origin?.serviceTypeId ?? null,
          inspectionId, advisorUserId: u.id,
          simpleRepair: true, repairClientUuid: dto.clientUuid, status: "IN_PROGRESS",
          repairStatus: "IN_PROGRESS", repairVersion: 0, repairNotes: dto.notes,
          estimatedRepairCentavos: BigInt(dto.estimatedTotalCentavos), repairRechecked: false, repairStartedAt: now,
        },
        include: repairInclude,
      });
      const response = presentRepair(repair);
      await tx.auditLog.create({ data: {
        actorUserId: u.id, action: "SIMPLE_REPAIR_STARTED", entityType: "WorkOrder", entityId: repair.id,
        after: response,
      } });
      return { repair: response, changed: true };
    }));
    if (result.changed) this.events.emitChanged(result.repair.vehicleId);
    return result.repair;
  }

  async updateReturned(u: AbilityUser, id: string, dto: SimpleRepairUpdateInput): Promise<RepairDto> {
    this.assertCanMutate(u);
    const result = await withNumberRetry(() => this.prisma.$transaction(async (tx) => {
      const replay = await this.replay(tx, dto.operationId, id, "UPDATE");
      if (replay) return { repair: replay, changed: false };
      await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${id}::uuid FOR UPDATE`;
      const lockedReplay = await this.replay(tx, dto.operationId, id, "UPDATE");
      if (lockedReplay) return { repair: lockedReplay, changed: false };
      const repair = await tx.workOrder.findFirst({ where: { id, simpleRepair: true }, include: repairInclude });
      if (!repair) throw new DomainError("WORK_ORDER_NOT_FOUND", "repair work not found", 404);
      if (repair.repairVersion !== dto.expectedVersion || repair.repairStatus !== "RETURNED_FOR_CORRECTION") {
        throw versionConflict(repair.repairVersion);
      }
      const updated = await tx.workOrder.updateMany({
        where: { id, simpleRepair: true, repairVersion: dto.expectedVersion, repairStatus: "RETURNED_FOR_CORRECTION" },
        data: {
          status: "IN_PROGRESS",
          repairStatus: "IN_PROGRESS",
          repairVersion: { increment: 1 },
          repairNotes: dto.notes,
          estimatedRepairCentavos: BigInt(dto.estimatedTotalCentavos),
          repairReviewReason: null,
          repairRechecked: false,
          repairCompletionNotes: null,
          completedWorkNotes: null,
          repairStopReason: null,
          repairCompletedAt: null,
          repairStoppedAt: null,
        },
      });
      if (updated.count !== 1) throw versionConflict(repair.repairVersion);
      const after = await tx.workOrder.findUniqueOrThrow({ where: { id }, include: repairInclude });
      const response = presentRepair(after);
      await tx.simpleRepairOperation.create({ data: { operationId: dto.operationId, workOrderId: id, action: "UPDATE", response } });
      await tx.auditLog.create({ data: {
        actorUserId: u.id, action: "SIMPLE_REPAIR_UPDATED_AFTER_RETURN",
        entityType: "WorkOrder", entityId: id, before: presentRepair(repair), after: response,
      } });
      return { repair: response, changed: true };
    }));
    if (result.changed) this.events.emitChanged(result.repair.vehicleId);
    return result.repair;
  }

  async scheduleReturn(u: AbilityUser, id: string, dto: SimpleRepairScheduleReturnInput): Promise<RepairDto> {
    this.assertCanMutate(u);
    const prior = await this.prisma.simpleRepairOperation.findUnique({ where: { operationId: dto.operationId } });
    if (prior) {
      if (prior.workOrderId !== id || prior.action !== "SCHEDULE_RETURN") throw operationConflict();
      return prior.response ? prior.response as unknown as RepairDto : this.get(u, id);
    }
    const hold = await this.holds.claim(dto.holdId, u.id);
    let committed = false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const replay = await this.replay(tx, dto.operationId, id, "SCHEDULE_RETURN");
        if (replay) return { repair: replay, changed: false };
        await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${id}::uuid FOR UPDATE`;
        const lockedReplay = await this.replay(tx, dto.operationId, id, "SCHEDULE_RETURN");
        if (lockedReplay) return { repair: lockedReplay, changed: false };
        const repair = await tx.workOrder.findFirst({ where: { id, simpleRepair: true }, include: repairInclude });
        if (!repair) throw new DomainError("WORK_ORDER_NOT_FOUND", "repair work not found", 404);
        if (repair.repairVersion !== dto.expectedVersion || repair.repairStatus !== "IN_PROGRESS") throw versionConflict(repair.repairVersion);
        if (repair.returnAppointment && repair.returnAppointment.status !== "CANCELLED") {
          throw new DomainError("DUPLICATE_REQUEST", "this repair already has a return visit; reschedule the existing visit", 409, { appointmentId: repair.returnAppointment.id });
        }
        if (!repair.repairOriginServiceTypeId || !repair.appointmentId) throw new DomainError("SLOT_UNAVAILABLE", "this repair has no booked service schedule to base a return visit on", 409);
        const origin = await tx.appointment.findUnique({
          where: { id: repair.appointmentId },
          select: { vehicleId: true, serviceTypeId: true, serviceNameSnapshot: true, serviceType: { select: { name: true } } },
        });
        if (!origin || origin.vehicleId !== repair.vehicleId || origin.serviceTypeId !== repair.repairOriginServiceTypeId || hold.serviceTypeId !== origin.serviceTypeId) {
          throw new DomainError("SLOT_UNAVAILABLE", "the return slot does not match this repair's original service", 409);
        }
        const start = new Date(hold.startIso);
        const end = new Date(hold.endIso);
        const conflict = await tx.appointment.findFirst({
          where: { bayId: hold.bayId, status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] }, scheduledStart: { lt: end }, scheduledEnd: { gt: start } },
          select: { id: true },
        });
        if (conflict) throw new DomainError("SLOT_UNAVAILABLE", "return slot is no longer available", 409);
        const returnData = {
            vehicleId: repair.vehicleId,
            serviceTypeId: origin.serviceTypeId,
            bayId: hold.bayId,
            scheduledStart: start,
            scheduledEnd: end,
            status: "BOOKED" as const,
            requiresPickup: false,
            createdBy: u.id,
            repairReturnWorkOrderId: repair.id,
            serviceNameSnapshot: `Repair return · ${origin.serviceNameSnapshot ?? origin.serviceType.name}`,
            currencySnapshot: "PHP",
            inspectionRequiredSnapshot: false,
            coveredBySubscription: false,
            billingSnapshotKnown: false,
          };
        const returnAppointment = repair.returnAppointment
          ? await tx.appointment.update({ where: { id: repair.returnAppointment.id }, data: returnData })
          : await tx.appointment.create({ data: returnData });
        const updated = await tx.workOrder.updateMany({
          where: { id, simpleRepair: true, repairVersion: dto.expectedVersion, repairStatus: "IN_PROGRESS" },
          data: { repairVersion: { increment: 1 } },
        });
        if (updated.count !== 1) throw versionConflict(repair.repairVersion);
        const after = await tx.workOrder.findUniqueOrThrow({ where: { id }, include: repairInclude });
        const response = presentRepair(after);
        await tx.simpleRepairOperation.create({ data: { operationId: dto.operationId, workOrderId: id, action: "SCHEDULE_RETURN", response } });
        await tx.auditLog.create({ data: {
          actorUserId: u.id, action: "SIMPLE_REPAIR_RETURN_SCHEDULED",
          entityType: "WorkOrder", entityId: id, before: presentRepair(repair), after: { ...response, returnAppointmentId: returnAppointment.id },
        } });
        return { repair: response, changed: true };
      });
      committed = true;
      if (result.changed) this.events.emitChanged(result.repair.vehicleId);
      return result.repair;
    } finally {
      if (!committed) await this.holds.restore(hold).catch(() => undefined);
    }
  }

  complete(u: AbilityUser, id: string, dto: SimpleRepairCompleteInput): Promise<RepairDto> {
    return this.transition(u, id, dto.operationId, dto.expectedVersion, "COMPLETE", {
      status: "QC", repairStatus: "AWAITING_ADMIN_REVIEW", repairRechecked: true,
      repairCompletionNotes: dto.completionNotes ?? null, repairCompletedAt: new Date(),
      repairStoppedAt: null, completedWorkNotes: null, repairStopReason: null,
    });
  }

  stop(u: AbilityUser, id: string, dto: SimpleRepairStopInput): Promise<RepairDto> {
    return this.transition(u, id, dto.operationId, dto.expectedVersion, "STOP", {
      status: "QC", repairStatus: "STOPPED", completedWorkNotes: dto.completedWorkNotes,
      repairStopReason: dto.reason, repairStoppedAt: new Date(), repairRechecked: false,
      repairCompletionNotes: null, repairCompletedAt: null,
    });
  }

  private async transition(
    u: AbilityUser, id: string, operationId: string, expectedVersion: number,
    action: SimpleRepairOperationAction, data: Prisma.WorkOrderUpdateManyMutationInput,
  ): Promise<RepairDto> {
    this.assertCanMutate(u);
    const result = await withNumberRetry(() => this.prisma.$transaction(async (tx) => {
      const replay = await this.replay(tx, operationId, id, action);
      if (replay) return { repair: replay, changed: false };
      await tx.$queryRaw`SELECT id FROM work_orders WHERE id = ${id}::uuid FOR UPDATE`;
      // A concurrent request may have committed its receipt while this one waited.
      const lockedReplay = await this.replay(tx, operationId, id, action);
      if (lockedReplay) return { repair: lockedReplay, changed: false };
      const repair = await tx.workOrder.findFirst({ where: { id, simpleRepair: true }, include: repairInclude });
      if (!repair) throw new DomainError("WORK_ORDER_NOT_FOUND", "repair work not found", 404);
      if (repair.repairVersion !== expectedVersion) throw versionConflict(repair.repairVersion);
      if (repair.repairStatus !== "IN_PROGRESS" && repair.repairStatus !== "RETURNED_FOR_CORRECTION") {
        throw new DomainError("ILLEGAL_TRANSITION", "only repair work in progress or returned for correction can be completed or stopped", 409);
      }
      const updated = await tx.workOrder.updateMany({
        where: { id, simpleRepair: true, repairVersion: expectedVersion, repairStatus: { in: ["IN_PROGRESS", "RETURNED_FOR_CORRECTION"] } },
        data: { ...data, repairVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw versionConflict(repair.repairVersion);
      if (action === "COMPLETE" && repair.returnAppointment && ["BOOKED", "CONFIRMED", "IN_PROGRESS"].includes(repair.returnAppointment.status)) {
        await tx.appointment.updateMany({
          where: { id: repair.returnAppointment.id, status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS"] } },
          data: { status: repair.returnAppointment.status === "IN_PROGRESS" ? "COMPLETED" : "CANCELLED" },
        });
      }
      const after = await tx.workOrder.findUniqueOrThrow({ where: { id }, include: repairInclude });
      const response = presentRepair(after);
      await tx.simpleRepairOperation.create({ data: { operationId, workOrderId: id, action, response } });
      await tx.auditLog.create({ data: {
        actorUserId: u.id, action: action === "COMPLETE" ? "SIMPLE_REPAIR_COMPLETED" : "SIMPLE_REPAIR_STOPPED",
        entityType: "WorkOrder", entityId: id, before: presentRepair(repair), after: response,
      } });
      return { repair: response, changed: true };
    }));
    if (result.changed) this.events.emitChanged(result.repair.vehicleId);
    return result.repair;
  }

  private async replay(tx: Prisma.TransactionClient, operationId: string, id: string, action: SimpleRepairOperationAction): Promise<RepairDto | null> {
    const operation = await tx.simpleRepairOperation.findUnique({ where: { operationId } });
    if (!operation) return null;
    if (operation.workOrderId !== id || operation.action !== action) throw operationConflict();
    if (operation.response) return operation.response as unknown as RepairDto;
    const repair = await tx.workOrder.findFirst({ where: { id, simpleRepair: true }, include: repairInclude });
    if (!repair) throw new DomainError("WORK_ORDER_NOT_FOUND", "repair work not found", 404);
    return presentRepair(repair);
  }
}

function presentRepair(repair: RepairRecord) {
  return {
    id: repair.id, number: repair.number, vehicleId: repair.vehicleId,
    inspectionId: repair.inspectionId!, appointmentId: repair.appointmentId, status: repair.status,
    serviceTypeId: repair.repairOriginServiceTypeId,
    repairStatus: repair.repairStatus!, version: repair.repairVersion, notes: repair.repairNotes ?? "",
    estimatedTotalCentavos: Number(repair.estimatedRepairCentavos ?? 0),
    finalRepairCentavos: repair.finalRepairCentavos == null ? null : Number(repair.finalRepairCentavos),
    rechecked: repair.repairRechecked === true, completionNotes: repair.repairCompletionNotes,
    completedWorkNotes: repair.completedWorkNotes, stopReason: repair.repairStopReason,
    reviewReason: repair.repairReviewReason, invoiceId: repair.invoices[0]?.id ?? null,
    createdAt: repair.openedAt.toISOString(), updatedAt: repair.updatedAt.toISOString(),
    returnAppointmentId: repair.returnAppointment?.status === "CANCELLED" ? null : repair.returnAppointment?.id ?? null,
    returnScheduledStart: repair.returnAppointment?.status === "CANCELLED" ? null : repair.returnAppointment?.scheduledStart.toISOString() ?? null,
    returnScheduledEnd: repair.returnAppointment?.status === "CANCELLED" ? null : repair.returnAppointment?.scheduledEnd.toISOString() ?? null,
  };
}

function operationConflict(): DomainError {
  return new DomainError("DUPLICATE_REQUEST", "this operation identifier belongs to another repair action", 409);
}

function versionConflict(version: number): DomainError {
  return new DomainError("ILLEGAL_TRANSITION", "repair work changed; refresh it before sending another action", 409, { version });
}
