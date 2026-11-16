import { randomUUID } from "crypto";
import { seedConfig } from "@autocare/scoring";
import type { SyncItemInput } from "@autocare/contracts";
import { InspectionSyncHandler } from "./inspection.handler";
import { AppointmentsService } from "../../scheduling/appointments.service";
import { SchedulingConfigService } from "../../scheduling/scheduling-config.service";

// Pin the same ordering as ABA1234: capture before the booked slot, followed by
// the nightly no-show sweep. Persistence is in memory; lifecycle and DTO code
// are the production implementations, so this never writes shared test data.
const CAPTURED = new Date("2026-11-15T08:27:21.273Z");
const SWEPT = new Date("2026-11-15T21:00:00.250Z");
const points = seedConfig.categories.flatMap((c) => c.points).map((p, i) => ({ ...p, id: `point-${i}` }));

function matches(row: any, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      return Object.entries(value).every(([op, bound]: [string, any]) => {
        if (op === "in") return bound.includes(row[key]);
        if (op === "lt") return row[key] < bound;
        if (op === "gte") return row[key] >= bound;
        if (op === "lte") return row[key] <= bound;
        throw new Error(`Unsupported persistence predicate: ${op}`);
      });
    }
    return row[key] === value;
  });
}

function journey(initialStatus = "BOOKED") {
  const user = { id: randomUUID(), role: "MECHANIC" as const };
  const booking = {
    id: randomUUID(), vehicleId: randomUUID(), serviceTypeId: randomUUID(), bayId: null,
    scheduledStart: new Date("2026-11-15T16:00:00Z"),
    scheduledEnd: new Date("2026-11-15T17:00:00Z"),
    status: initialStatus, requiresPickup: false,
    serviceType: { name: "Full Inspection", inspectionRequired: true }, vehicle: { plateNo: "FIXTURE", owner: null },
  };
  const inspections: any[] = [];
  const versionId = randomUUID();
  const db = {
    user: { findUniqueOrThrow: async () => ({ isCertifiedTechnician: true }) },
    checklistVersion: { findUnique: async () => ({ id: versionId }) },
    checklistPoint: { findMany: async () => points, count: async () => points.length },
    inspection: {
      create: async ({ data }: any) => {
        const row = { id: randomUUID(), submittedAt: null, results: [], ...data };
        inspections.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => inspections.find((row) => matches(row, where)) ?? null,
      update: async ({ where, data }: any) => Object.assign(inspections.find((row) => matches(row, where)), data),
    },
    inspectionResult: {
      createMany: async ({ data }: any) => {
        for (const result of data) inspections.find((row) => row.id === result.inspectionId).results.push(result);
        return { count: data.length };
      },
    },
    appointment: {
      findUnique: async ({ where }: any) => matches(booking, where) ? { ...booking } : null,
      findMany: jest.fn(async ({ where }: any) => matches(booking, where) ? [{ ...booking }] : []),
      updateMany: async ({ where, data }: any) => {
        if (!matches(booking, where)) return { count: 0 };
        Object.assign(booking, data);
        return { count: 1 };
      },
      count: async ({ where }: any) => Number(matches(booking, where)),
    },
    auditLog: { create: jest.fn() },
  };
  const handler = new InspectionSyncHandler(null);
  const appointments = new AppointmentsService(db as any, null as any, null as any, { now: () => SWEPT }, null as any);
  const board = new SchedulingConfigService(db as any);
  const clientUuid = randomUUID();
  const create = (overrides: Record<string, unknown> = {}): SyncItemInput => ({
    clientUuid, entityType: "inspection", op: "create",
    payload: {
      vehicleId: booking.vehicleId, appointmentId: booking.id, checklistVersionId: versionId,
      results: points.map((p) => ({ pointCode: p.code, status: "GOOD" })), ...overrides,
    },
  });
  const submit: SyncItemInput = {
    clientUuid: randomUUID(), entityType: "inspection", op: "submit",
    payload: { inspectionClientUuid: clientUuid, submittedAt: CAPTURED.toISOString() },
  };
  const apply = (item: SyncItemInput) => handler.apply(db as any, user, item);
  const visibleStatuses = async () => [
    (await appointments.listForUser(user))[0].status,
    (await board.board(user, "2026-11-16", "2026-11-16"))[0].status,
  ];
  return { booking, db, inspections, apply, create, submit, appointments, visibleStatuses };
}

describe("inspection → booking lifecycle", () => {
  it("rejects an unconfigured service, independently of its display name", async () => {
    const j = journey();
    j.booking.serviceType.inspectionRequired = false;
    await expect(j.apply(j.create())).rejects.toMatchObject({ code: "INSPECTION_INCOMPLETE" });
    expect(j.inspections).toHaveLength(0);
  });
  it("completes an early inspection's exact booking before the later no-show sweep", async () => {
    const j = journey();
    await j.apply(j.create());
    await j.apply(j.submit);
    expect(await j.appointments.flagNoShows(SWEPT)).toEqual({ flagged: 0 });
    expect(await j.visibleStatuses()).toEqual(["COMPLETED", "COMPLETED"]);
    expect(j.inspections[0]).toMatchObject({ appointmentId: j.booking.id, submittedAt: CAPTURED });
  });

  it("resolves an automatic no-show when valid offline work is accepted later", async () => {
    const j = journey();
    await j.apply(j.create());
    await j.appointments.flagNoShows(SWEPT);
    expect(j.booking.status).toBe("NO_SHOW");
    await j.apply(j.submit);
    expect(await j.visibleStatuses()).toEqual(["COMPLETED", "COMPLETED"]);
  });

  it("keeps cancellation authoritative while retaining the submitted report", async () => {
    const j = journey("CANCELLED");
    await j.apply(j.create());
    await j.apply(j.submit);
    expect(await j.visibleStatuses()).toEqual(["CANCELLED", "CANCELLED"]);
    expect(j.inspections[0].submittedAt).toEqual(CAPTURED);
  });

  it("rejects a booking/vehicle mismatch before recording the inspection", async () => {
    const j = journey();
    await expect(j.apply(j.create({ vehicleId: randomUUID() })))
      .rejects.toMatchObject({ code: "INSPECTION_BOOKING_MISMATCH" });
    expect(j.inspections).toHaveLength(0);
    expect(j.booking.status).toBe("BOOKED");
  });

  it("rejects a missing referenced booking instead of accepting a dangling link", async () => {
    const j = journey();
    await expect(j.apply(j.create({ appointmentId: randomUUID() })))
      .rejects.toMatchObject({ code: "INSPECTION_BOOKING_NOT_FOUND" });
    expect(j.inspections).toHaveLength(0);
  });

  it("does not complete a booking when the report is incomplete", async () => {
    const j = journey("NO_SHOW");
    await j.apply(j.create({ results: [{ pointCode: points[0].code, status: "GOOD" }] }));
    await expect(j.apply(j.submit)).rejects.toMatchObject({ code: "INSPECTION_INCOMPLETE" });
    expect(await j.visibleStatuses()).toEqual(["NO_SHOW", "NO_SHOW"]);
    expect(j.inspections[0].submittedAt).toBeNull();
  });

  it("does not overwrite completion if the sweep read its candidate before sync finished", async () => {
    const j = journey();
    await j.apply(j.create());
    j.db.appointment.findMany.mockImplementationOnce(async () => {
      const candidate = { ...j.booking };
      await j.apply(j.submit);
      return [candidate];
    });
    expect(await j.appointments.flagNoShows(SWEPT)).toEqual({ flagged: 0 });
    expect(await j.visibleStatuses()).toEqual(["COMPLETED", "COMPLETED"]);
  });
});
