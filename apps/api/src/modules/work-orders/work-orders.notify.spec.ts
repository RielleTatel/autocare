import { WorkOrdersService } from "./work-orders.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnnouncementsService } from "../announcements/announcements.service";
import type { WorkOrderConfigService } from "./config.service";
import type { AuditService } from "../../common/audit/audit.service";
import type { WorkOrderEvents } from "./work-order-events";

/**
 * "Your car is ready" is the moment a member most wants to hear from us, and it
 * was the one lifecycle event that told nobody. These tests are about which
 * thread event closing a work order emits — not how the thread is persisted,
 * which the announcements specs already cover.
 */
describe("WorkOrdersService — closing tells the member (SERVICE_COMPLETED)", () => {
  const applyThreadEvent = jest.fn(async () => undefined);
  const announcements = { applyThreadEvent } as unknown as AnnouncementsService;

  const workOrder = (over: Record<string, unknown> = {}) => ({
    id: "wo-1",
    vehicleId: "veh-1",
    status: "READY",
    appointmentId: "appt-1",
    items: [],
    ...over,
  });

  function build(over: Record<string, unknown> = {}) {
    const prisma = {
      workOrder: {
        findUnique: jest.fn().mockResolvedValue(workOrder()),
        update: jest.fn().mockResolvedValue(workOrder({ status: "CLOSED" })),
      },
      vehicle: { findUnique: jest.fn().mockResolvedValue({ id: "veh-1", ownerUserId: "user-1" }) },
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: "appt-1",
          serviceTypeId: "st-1",
          serviceType: { name: "Brake Service" },
        }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      part: { findUnique: jest.fn(), update: jest.fn() },
      ...over,
    } as unknown as PrismaService;

    const svc = new WorkOrdersService(
      prisma,
      { } as unknown as WorkOrderConfigService,
      { record: jest.fn() } as unknown as AuditService,
      { closed: jest.fn() } as unknown as WorkOrderEvents,
      announcements,
    );
    return { svc, prisma };
  }

  beforeEach(() => applyThreadEvent.mockClear());

  it("closes the member's thread when the work order closes", async () => {
    const { svc } = build();
    await svc.notifyServiceCompleted(workOrder() as never);
    expect(applyThreadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        vehicleId: "veh-1",
        serviceTypeId: "st-1",
        serviceTypeName: "Brake Service",
        event: { type: "SERVICE_COMPLETED" },
      }),
    );
  });

  // A walk-in has no appointment, so there is no service type and no thread to
  // close. That is a no-op, not an error — the car still gets fixed.
  it("says nothing for a walk-in with no appointment", async () => {
    const { svc } = build();
    await svc.notifyServiceCompleted(workOrder({ appointmentId: null }) as never);
    expect(applyThreadEvent).not.toHaveBeenCalled();
  });

  // A fleet vehicle owned by an organisation has no single member to tell.
  it("says nothing when the vehicle has no personal owner", async () => {
    const { svc } = build({
      vehicle: { findUnique: jest.fn().mockResolvedValue({ id: "veh-1", ownerUserId: null }) },
    });
    await svc.notifyServiceCompleted(workOrder() as never);
    expect(applyThreadEvent).not.toHaveBeenCalled();
  });

  // Closing a work order decrements stock and issues an invoice. A notification
  // failure must not roll that back or surface as a failed close.
  it("never fails the close because the notification failed", async () => {
    applyThreadEvent.mockRejectedValueOnce(new Error("announcements down"));
    const { svc } = build();
    await expect(svc.notifyServiceCompleted(workOrder() as never)).resolves.toBeUndefined();
  });
});
