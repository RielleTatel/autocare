import { SchedulingConfigService } from "./scheduling-config.service";
import { DomainError } from "../../common/errors/domain-error";

const staff = { id: "u1", role: "ADVISOR" } as never;
const member = { id: "u2", role: "MEMBER" } as never;

const rows = [{ weekday: "MON", dateOverride: null, openTime: "08:00", closeTime: "17:00", walkInBufferPct: 20 }];
const prisma = { operatingHours: { findMany: jest.fn().mockResolvedValue(rows) } } as never;

describe("SchedulingConfigService.listOperatingHours", () => {
  it("returns the configured hours to staff", async () => {
    const svc = new SchedulingConfigService(prisma);
    await expect(svc.listOperatingHours(staff)).resolves.toEqual(rows);
  });

  it("refuses non-staff", async () => {
    const svc = new SchedulingConfigService(prisma);
    await expect(svc.listOperatingHours(member)).rejects.toThrow(DomainError);
  });
});
