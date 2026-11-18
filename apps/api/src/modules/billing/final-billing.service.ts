import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { FinalBillingIssueInput, FinalBillingReturnInput } from "@autocare/contracts";
import { DomainError } from "../../common/errors/domain-error";
import { AbilityUser } from "../../common/policies/ability.factory";
import { PrismaService } from "../prisma/prisma.service";
import { nextInvoiceNumber, withInvoiceNumberRetry } from "../subscriptions/invoice-numbering";

const DUE_DAYS = 7;
const REVIEW_REPAIR_STATES = ["AWAITING_ADMIN_REVIEW", "STOPPED", "RETURNED_FOR_CORRECTION"] as const;

@Injectable()
export class FinalBillingService {
  constructor(private prisma: PrismaService) {}

  private requireAdmin(user: AbilityUser): void {
    if (user.role !== "ADMIN") throw new DomainError("FORBIDDEN_ROLE", "only administrators can review and issue final bills", 403);
  }

  async listReviews(user: AbilityUser) {
    this.requireAdmin(user);
    const appointments = await this.prisma.appointment.findMany({
      where: { status: "COMPLETED", billingStatus: { not: "ISSUED" }, repairReturnWorkOrderId: null },
      include: {
        serviceType: true,
        vehicle: { select: { id: true, plateNo: true } },
        invoice: { select: { id: true } },
        billingHistory: { include: { actorUser: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { scheduledStart: "desc" },
      take: 200,
    });
    if (!appointments.length) return [];
    const repairs = await this.prisma.workOrder.findMany({
      where: { appointmentId: { in: appointments.map((appointment) => appointment.id) }, simpleRepair: true },
      include: { invoices: { select: { id: true } } },
      orderBy: { openedAt: "desc" },
    });
    const repairByAppointment = new Map<string, (typeof repairs)[number]>();
    for (const repair of repairs) if (repair.appointmentId && !repairByAppointment.has(repair.appointmentId)) repairByAppointment.set(repair.appointmentId, repair);
    return appointments
      .filter((appointment) => {
        const repair = repairByAppointment.get(appointment.id);
        return !repair || REVIEW_REPAIR_STATES.includes(repair.repairStatus as typeof REVIEW_REPAIR_STATES[number]);
      })
      .map((appointment) => this.present(appointment, repairByAppointment.get(appointment.id) ?? null));
  }

  async getReview(user: AbilityUser, appointmentId: string) {
    this.requireAdmin(user);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        serviceType: true,
        vehicle: { select: { id: true, plateNo: true } },
        invoice: { select: { id: true } },
        billingHistory: { include: { actorUser: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!appointment || appointment.repairReturnWorkOrderId) throw new DomainError("BILLING_REVIEW_NOT_FOUND", "completed service review not found", 404);
    const repair = await this.prisma.workOrder.findFirst({
      where: { appointmentId, simpleRepair: true },
      include: { invoices: { select: { id: true } } },
      orderBy: { openedAt: "desc" },
    });
    return this.present(appointment, repair);
  }

  async returnForCorrection(user: AbilityUser, appointmentId: string, dto: FinalBillingReturnInput) {
    this.requireAdmin(user);
    const operationId = dto.operationId ?? randomUUID();
    const replay = await this.prisma.appointmentBillingHistory.findUnique({ where: { operationId } });
    if (replay) {
      if (replay.appointmentId !== appointmentId) throw new DomainError("DUPLICATE_REQUEST", "operation id was already used for a different review", 409);
      return this.getReview(user, appointmentId);
    }
    const review = await this.loadReviewForMutation(appointmentId);
    if (review.appointment.billingVersion !== dto.expectedVersion || review.appointment.billingStatus === "ISSUED" || review.appointment.invoice) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "the review changed or a final bill was already issued; reload it before trying again", 409);
    }
    const repair = review.repair;

    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.updateMany({
          where: { id: appointmentId, status: "COMPLETED", billingVersion: dto.expectedVersion, billingStatus: { not: "ISSUED" } },
          data: { billingStatus: "RETURNED", billingVersion: { increment: 1 } },
        });
        if (updated.count !== 1) throw new DomainError("BILLING_REVIEW_CONFLICT", "the review changed; reload before trying again", 409);
        if (repair && (repair.repairStatus === "AWAITING_ADMIN_REVIEW" || repair.repairStatus === "STOPPED")) {
          const changedRepair = await tx.workOrder.updateMany({
            where: { id: repair.id, simpleRepair: true, repairVersion: repair.repairVersion, repairStatus: repair.repairStatus },
            data: {
              repairStatus: "RETURNED_FOR_CORRECTION",
              repairVersion: { increment: 1 },
              repairReviewReason: dto.reason,
              status: "IN_PROGRESS",
            },
          });
          if (changedRepair.count !== 1) throw new DomainError("BILLING_REVIEW_CONFLICT", "repair state changed; reload before trying again", 409);
        }
        await tx.appointmentBillingHistory.create({
          data: {
            appointmentId,
            actorUserId: user.id,
            operationId,
            action: "RETURNED_FOR_CORRECTION",
            notes: dto.reason,
            before: { billingStatus: review.appointment.billingStatus, billingVersion: review.appointment.billingVersion },
            after: { billingStatus: "RETURNED", billingVersion: dto.expectedVersion + 1 },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await this.prisma.appointmentBillingHistory.findUnique({ where: { operationId } });
        if (duplicate?.appointmentId === appointmentId) return this.getReview(user, appointmentId);
      }
      throw error;
    }
    return this.getReview(user, appointmentId);
  }

  async issue(user: AbilityUser, appointmentId: string, dto: FinalBillingIssueInput) {
    this.requireAdmin(user);
    const operationId = dto.operationId ?? randomUUID();
    const replay = await this.prisma.appointmentBillingHistory.findUnique({ where: { operationId } });
    if (replay) {
      if (replay.appointmentId !== appointmentId) throw new DomainError("DUPLICATE_REQUEST", "operation id was already used for a different review", 409);
      return this.getReview(user, appointmentId);
    }
    const review = await this.loadReviewForMutation(appointmentId);
    const appointment = review.appointment;
    const repair = review.repair;
    if (appointment.billingVersion !== dto.expectedVersion || appointment.billingStatus === "ISSUED") {
      if (appointment.invoice) return this.getReview(user, appointmentId);
      throw new DomainError("BILLING_REVIEW_CONFLICT", "the review changed; reload before issuing a bill", 409);
    }
    if (appointment.status !== "COMPLETED") throw new DomainError("BILLING_REVIEW_CONFLICT", "only a completed service can be billed", 409);
    if (appointment.invoice || (repair?.invoices.length ?? 0) > 0) return this.getReview(user, appointmentId);
    if (repair && !["AWAITING_ADMIN_REVIEW", "STOPPED"].includes(repair.repairStatus ?? "")) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "repair work must be completed or stopped and submitted for review", 409);
    }
    if (repair?.repairStatus === "AWAITING_ADMIN_REVIEW" && repair.repairRechecked !== true) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "the mechanic must confirm the repair was rechecked before billing", 409);
    }
    if (repair?.repairStatus === "STOPPED" && !repair.completedWorkNotes?.trim()) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "stopped work needs notes describing what was completed", 409);
    }
    if (repair && dto.finalRepairCentavos === undefined) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "enter the admin-verified final repair amount", 422);
    }

    const legacyProvenance = !appointment.billingSnapshotKnown || appointment.servicePriceCentavosSnapshot === null || appointment.coveredBySubscription === null;
    const covered = appointment.coveredBySubscription === true;
    const capturedServiceCharge = legacyProvenance ? null : covered ? 0 : Number(appointment.servicePriceCentavosSnapshot);
    const serviceCharge = dto.serviceChargeCentavos ?? capturedServiceCharge;
    if (serviceCharge === null || serviceCharge === undefined) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "verify and enter the original service charge before issuing this legacy bill", 422);
    }
    if (legacyProvenance && !dto.serviceChargeReason?.trim()) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "record what source was used to verify the legacy service charge", 422);
    }
    if (capturedServiceCharge !== null && serviceCharge !== capturedServiceCharge && !dto.serviceChargeReason?.trim()) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "record why the original service charge differs from its booking snapshot", 422);
    }
    if (covered && serviceCharge !== 0) throw new DomainError("BILLING_REVIEW_CONFLICT", "a subscription-covered service cannot receive an extra service charge", 422);
    if (!Number.isSafeInteger(serviceCharge) || serviceCharge < 0) throw new DomainError("BILLING_REVIEW_CONFLICT", "service charge must be a nonnegative PHP amount", 422);
    const repairCharge = repair ? dto.finalRepairCentavos! : 0;
    const total = serviceCharge + repairCharge;
    if (!Number.isSafeInteger(total) || total > 200_000_000) throw new DomainError("BILLING_REVIEW_CONFLICT", "final total is outside the supported range", 422);
    const now = new Date();

    try {
      await withInvoiceNumberRetry(() => this.prisma.$transaction(async (tx) => {
        const latestReplay = await tx.appointmentBillingHistory.findUnique({ where: { operationId } });
        if (latestReplay) return;
        const advanced = await tx.appointment.updateMany({
          where: {
            id: appointmentId,
            status: "COMPLETED",
            billingVersion: dto.expectedVersion,
            billingStatus: { not: "ISSUED" },
          },
          data: {
            billingStatus: "ISSUED",
            billingVersion: { increment: 1 },
            finalServiceChargeCentavos: BigInt(serviceCharge),
          },
        });
        if (advanced.count !== 1) throw new DomainError("BILLING_REVIEW_CONFLICT", "another review action changed this bill; reload before issuing", 409);
        if (repair) {
          const repairUpdate = await tx.workOrder.updateMany({
            where: {
              id: repair.id,
              simpleRepair: true,
              repairVersion: repair.repairVersion,
              repairStatus: repair.repairStatus,
            },
            data: {
              repairStatus: repair.repairStatus === "STOPPED" ? "STOPPED" : "VERIFIED",
              repairVersion: { increment: 1 },
              finalRepairCentavos: BigInt(repairCharge),
              repairVerifiedAt: now,
              repairVerifiedByUserId: user.id,
              repairReviewReason: null,
              status: "CLOSED",
            },
          });
          if (repairUpdate.count !== 1) throw new DomainError("BILLING_REVIEW_CONFLICT", "repair work changed while the bill was issued; reload and retry", 409);
          await tx.appointment.updateMany({
            where: { repairReturnWorkOrderId: repair.id, status: { in: ["BOOKED", "CONFIRMED"] } },
            data: { status: "CANCELLED" },
          });
        }
        const number = await nextInvoiceNumber(tx);
        const invoice = await tx.invoice.create({
          data: {
            appointmentId,
            workOrderId: repair?.id ?? null,
            number,
            totalCentavos: BigInt(total),
            status: total === 0 ? "PAID" : "AWAITING_CASH",
            documentKind: total === 0 ? "NO_CHARGE" : "BILL",
            dueDate: new Date(now.getTime() + DUE_DAYS * 86_400_000),
            items: {
              create: [
                {
                  description: appointment.serviceNameSnapshot ?? appointment.serviceType.name,
                  qty: 1,
                  unitPriceCentavos: BigInt(serviceCharge),
                  source: "SERVICE",
                },
                ...(repair ? [{
                  description: "Additional repairs",
                  qty: 1,
                  unitPriceCentavos: BigInt(repairCharge),
                  source: "REPAIR" as const,
                }] : []),
              ],
            },
          },
        });
        await tx.appointmentBillingHistory.create({
          data: {
            appointmentId,
            actorUserId: user.id,
            operationId,
            action: "VERIFIED_AND_ISSUED",
            notes: dto.serviceChargeReason?.trim() || null,
            before: { billingStatus: appointment.billingStatus, billingVersion: appointment.billingVersion },
            after: { billingStatus: "ISSUED", billingVersion: dto.expectedVersion + 1, invoiceId: invoice.id, totalCentavos: total, serviceChargeCentavos: serviceCharge, legacyProvenanceReviewed: legacyProvenance },
          },
        });
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await this.prisma.invoice.findUnique({ where: { appointmentId }, select: { id: true } });
        if (concurrent) return this.getReview(user, appointmentId);
      }
      throw error;
    }
    return this.getReview(user, appointmentId);
  }

  private async loadReviewForMutation(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { serviceType: true, vehicle: { select: { id: true, plateNo: true } }, invoice: { select: { id: true } } },
    });
    if (!appointment) throw new DomainError("BILLING_REVIEW_NOT_FOUND", "completed service review not found", 404);
    if (appointment.repairReturnWorkOrderId) {
      throw new DomainError("BILLING_REVIEW_CONFLICT", "repair return visits are not billed separately from the original service", 409);
    }
    const repair = await this.prisma.workOrder.findFirst({
      where: { appointmentId, simpleRepair: true },
      include: { invoices: { select: { id: true } } },
      orderBy: { openedAt: "desc" },
    });
    return { appointment, repair };
  }

  private present(appointment: Prisma.AppointmentGetPayload<{
    include: {
      serviceType: true;
      vehicle: { select: { id: true; plateNo: true } };
      invoice: { select: { id: true } };
      billingHistory: { include: { actorUser: { select: { name: true } } } };
    };
  }>, repair: Prisma.WorkOrderGetPayload<{ include: { invoices: { select: { id: true } } } }> | null) {
    const invoiceId = appointment.invoice?.id ?? repair?.invoices[0]?.id ?? null;
    const covered = appointment.coveredBySubscription === true;
    const capturedPrice = appointment.servicePriceCentavosSnapshot === null ? null : Number(appointment.servicePriceCentavosSnapshot);
    return {
      appointmentId: appointment.id,
      version: appointment.billingVersion,
      vehicleId: appointment.vehicleId,
      vehiclePlateNo: appointment.vehicle.plateNo,
      service: {
        name: appointment.serviceNameSnapshot ?? appointment.serviceType.name,
        priceCentavos: capturedPrice,
        covered,
        legacyProvenance: !appointment.billingSnapshotKnown || capturedPrice === null || appointment.coveredBySubscription === null,
        chargeCentavos: appointment.finalServiceChargeCentavos !== null
          ? Number(appointment.finalServiceChargeCentavos)
          : covered ? 0 : capturedPrice,
        alreadyBilled: invoiceId !== null,
        previousInvoiceId: invoiceId,
      },
      repair: repair ? {
        id: repair.id,
        notes: repair.repairNotes ?? "",
        estimatedTotalCentavos: Number(repair.estimatedRepairCentavos ?? 0n),
        completedWorkNotes: repair.completedWorkNotes,
        completionNotes: repair.repairCompletionNotes,
        outcome: repair.repairStatus ?? "IN_PROGRESS",
        rechecked: repair.repairRechecked === true,
        finalRepairCentavos: repair.finalRepairCentavos === null ? null : Number(repair.finalRepairCentavos),
      } : null,
      status: appointment.billingStatus,
      invoiceId,
      history: appointment.billingHistory.map((entry) => ({
        action: entry.action,
        actorName: entry.actorUser.name,
        at: entry.createdAt.toISOString(),
        notes: entry.notes,
      })),
    };
  }
}
