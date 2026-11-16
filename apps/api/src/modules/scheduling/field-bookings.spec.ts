import { randomUUID } from "crypto";
import { fieldBookingQuerySchema, serviceTypeSchema } from "@autocare/contracts";
import { SchedulingConfigService } from "./scheduling-config.service";

const staff = { id: randomUUID(), role: "MECHANIC" as const };
const day = "2026-11-16";
const row = (start: string, overrides: any = {}) => ({
  id: randomUUID(), vehicleId: randomUUID(), serviceTypeId: randomUUID(), bayId: null,
  scheduledStart: new Date(start), scheduledEnd: new Date(Date.parse(start) + 3600000),
  status: "BOOKED", requiresPickup: false,
  serviceType: { name: "Renamed service", inspectionRequired: true },
  vehicle: { plateNo: "ABA1234", make: "Toyota", model: "Vios", year: 2024, owner: null },
  ...overrides,
});

function match(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "AND") return value.every((w: any) => match(row, w));
    if (key === "OR") return value.some((w: any) => match(row, w));
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.entries(value).every(([op, bound]: [string, any]) => {
        if (op === "in") return bound.includes(row[key]);
        if (op === "gte") return row[key] >= bound;
        if (op === "lt") return row[key] < bound;
        if (op === "gt") return row[key] > bound;
        throw new Error(`Unknown predicate ${op}`);
      });
    }
    return value instanceof Date ? +row[key] === +value : row[key] === value;
  });
}

function setup(rows: any[]) {
  const reports: any[] = [];
  const db = {
    user: { findUnique: jest.fn(async () => ({ isCertifiedTechnician: true })) },
    appointment: {
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        const order = Array.isArray(orderBy) ? orderBy : [orderBy];
        return rows.filter(r => match(r, where)).sort((a, b) => {
          for (const part of order) {
            const [key, dir] = Object.entries(part)[0];
            const diff = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
            if (diff) return dir === "desc" ? -diff : diff;
          }
          return 0;
        }).slice(0, take);
      }),
      findUnique: jest.fn(async ({ where }: any) => rows.find(r => r.id === where.id) ?? null),
    },
    inspection: { findMany: jest.fn(async () => reports) },
    serviceBay: { findMany: jest.fn(async () => []) },
  };
  return { service: new SchedulingConfigService(db as any), db, reports };
}

describe("Field booking API", () => {
  it("uses whole Manila calendar days including the final milliseconds", async () => {
    const fixtures = [row("2026-11-15T15:59:59.999Z"), row("2026-11-15T16:00:00Z"), row("2026-11-16T15:59:59.999Z"), row("2026-11-16T16:00:00Z")];
    const { service } = setup(fixtures);
    const today = await service.fieldBookings(staff, { bucket: "today", day, limit: 30 });
    expect(today.items.map(i => i.id)).toEqual(fixtures.slice(1, 3).map(r => r.id));
    expect((await service.fieldBookings(staff, { bucket: "past", day, limit: 30 })).items.map(i => i.id)).toEqual([fixtures[0].id]);
    expect((await service.fieldBookings(staff, { bucket: "upcoming", day, limit: 30 })).items.map(i => i.id)).toEqual([fixtures[3].id]);
    expect((await service.board(staff, day, day)).map(i => i.id)).toEqual(fixtures.slice(1, 3).map(r => r.id));
  });

  it("makes all history reachable across pages, including tied timestamps", async () => {
    const fixtures = [row("2000-01-01T00:00:00Z"), row("2026-11-16T00:00:00Z"), row("2026-11-16T00:00:00Z"), row("2040-01-01T00:00:00Z")];
    const { service } = setup(fixtures);
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.fieldBookings(staff, { bucket: "all", day, limit: 2, cursor });
      ids.push(...page.items.map(i => i.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(ids)).toEqual(new Set(fixtures.map(r => r.id)));
    expect(ids).toHaveLength(4);
  });

  it("does not let a cursor mix filters or Manila day coverage", async () => {
    const { service } = setup([row("2026-11-16T00:00:00Z"), row("2026-11-16T01:00:00Z")]);
    const first = await service.fieldBookings(staff, { bucket: "today", day, limit: 1 });
    await expect(service.fieldBookings(staff, { bucket: "all", day, limit: 1, cursor: first.nextCursor! })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(service.fieldBookings(staff, { bucket: "today", day: "2026-11-17", limit: 1, cursor: first.nextCursor! })).rejects.toThrow("invalid booking cursor");
    await expect(service.fieldBookings(staff, { bucket: "all", day: "2026-02-30", limit: 1 })).rejects.toThrow("invalid calendar date");
  });

  it("exposes certification, explicit service setting and accepted report independently", async () => {
    const fixtures = [row("2026-11-16T00:00:00Z"), row("2026-11-16T01:00:00Z", { serviceType: { name: "Full Inspection", inspectionRequired: false } }), row("2026-11-16T02:00:00Z", { status: "NO_SHOW" })];
    const { service, db, reports } = setup(fixtures);
    expect((await service.fieldBooking(staff, fixtures[0].id)).canInspect).toBe(true);
    expect(await service.fieldBooking(staff, fixtures[1].id)).toMatchObject({ canInspect: true, inspectionRequired: false });
    expect(await service.fieldBooking(staff, fixtures[2].id)).toMatchObject({ canInspect: true, status: "NO_SHOW" });
    db.user.findUnique.mockResolvedValueOnce({ isCertifiedTechnician: false });
    expect((await service.fieldBooking(staff, fixtures[0].id)).canInspect).toBe(false);
    reports.push({ appointmentId: fixtures[0].id, id: randomUUID(), healthScore: null });
    expect(await service.fieldBooking(staff, fixtures[0].id)).toMatchObject({ canInspect: true, scorePending: true, inspectionId: reports[0].id });
    await expect(service.fieldBooking({ ...staff, role: "DRIVER" }, fixtures[0].id)).rejects.toThrow("staff only");
  });

  it("validates page bounds and defaults new services to no inspection", () => {
    expect(fieldBookingQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(fieldBookingQuerySchema.parse({})).toMatchObject({ bucket: "today", limit: 30 });
    expect(serviceTypeSchema.parse({ name: "Full Inspection", code: "TEST", standardDurationMin: 60, priceCentavos: 0 }).inspectionRequired).toBe(false);
  });
});
