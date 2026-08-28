import { WasteExportService } from "./waste-export.service";
import { DomainError } from "../../common/errors/domain-error";

const NOW = new Date("2026-08-28T00:00:00.000Z");
const clock = { now: () => NOW };
const admin = { id: "u-admin", role: "ADMIN" } as never;
const advisor = { id: "u-adv", role: "ADVISOR" } as never;

const record = {
  wasteType: "USED_OIL",
  quantity: 4.2,
  unit: "L",
  haulerName: "Zamboanga Enviro",
  manifestNo: "MF-99",
  disposedAt: new Date("2026-08-20T00:00:00.000Z"),
  createdAt: new Date("2026-08-20T00:00:00.000Z"),
  workOrder: { number: "WO-202608-0001", vehicle: { plateNo: "ABC 1234" } },
};

function makePrisma() {
  return {
    wasteRecord: { findMany: jest.fn().mockResolvedValue([record]) },
    auditLog: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
  } as never;
}

type PrismaStub = {
  wasteRecord: { findMany: jest.Mock };
  auditLog: { create: jest.Mock; findFirst: jest.Mock };
};

describe("WasteExportService", () => {
  it("refuses non-admins on export", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    await expect(svc.exportCsv(advisor, "2026-07-01", "2026-09-30")).rejects.toThrow(DomainError);
  });

  it("returns CSV for the window", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    const csv = await svc.exportCsv(admin, "2026-07-01", "2026-09-30");
    expect(csv.split("\n")[0]).toContain("disposed_at");
    expect(csv).toContain("WO-202608-0001");
    expect(csv).toContain("ABC 1234");
  });

  it("audit-logs every export — this is a compliance document", async () => {
    const prisma = makePrisma();
    const svc = new WasteExportService(prisma, clock);
    await svc.exportCsv(admin, "2026-07-01", "2026-09-30");
    expect((prisma as unknown as PrismaStub).auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "WASTE_EXPORTED", actorUserId: "u-admin" }),
      }),
    );
  });

  it("summarises totals per waste type", async () => {
    const svc = new WasteExportService(makePrisma(), clock);
    const out = await svc.summary(admin, "2026-07-01", "2026-09-30");
    expect(out.recordCount).toBe(1);
    expect(out.totals).toEqual([{ wasteType: "USED_OIL", quantity: 4.2, unit: "L" }]);
  });

  it("reports the last export date from the audit trail", async () => {
    const prisma = makePrisma();
    (prisma as unknown as PrismaStub).auditLog.findFirst
      .mockResolvedValue({ createdAt: new Date("2026-06-30T00:00:00.000Z") });
    const svc = new WasteExportService(prisma, clock);
    const out = await svc.summary(admin, "2026-07-01", "2026-09-30");
    expect(out.lastExportedAt).toBe("2026-06-30T00:00:00.000Z");
  });
});
