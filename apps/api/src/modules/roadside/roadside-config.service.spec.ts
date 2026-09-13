import { RoadsideConfigService, DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG } from "./roadside-config.service";
import { DomainError } from "../../common/errors/domain-error";

function makeService(rows: Array<{ key: string; value: string }> = []) {
  const prisma = {
    systemConfig: { findMany: jest.fn().mockResolvedValue(rows), upsert: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  return { service: new RoadsideConfigService(prisma as never, audit as never), prisma, audit };
}

describe("RoadsideConfigService", () => {
  it("uses the documented defaults when configuration is absent", async () => {
    const { service } = makeService();
    await expect(service.get()).resolves.toEqual(DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG);
  });

  it("falls back safely when persisted values are invalid", async () => {
    const { service } = makeService([
      { key: "roadside_waiting_days", value: "" },
      { key: "roadside_require_cleared_payment", value: "maybe" },
    ]);
    await expect(service.get()).resolves.toEqual(DEFAULT_ROADSIDE_ELIGIBILITY_CONFIG);
  });

  it("upserts both settings and audits a valid admin change", async () => {
    const { service, prisma, audit } = makeService();
    await expect(service.set({ id: "admin", role: "ADMIN" }, { waitingDays: 0, requireClearedPayment: false, reason: "launch promotion" }))
      .resolves.toEqual({ waitingDays: 0, requireClearedPayment: false });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      "admin",
      "ROADSIDE_ELIGIBILITY_CONFIG_UPDATED",
      "SystemConfig",
      "roadside_eligibility",
      expect.anything(),
      { waitingDays: 0, requireClearedPayment: false, reason: "launch promotion" },
    );
  });

  it("rejects a non-admin", async () => {
    const { service } = makeService();
    await expect(service.set({ id: "member", role: "MEMBER" }, { waitingDays: 30, requireClearedPayment: true, reason: "not allowed" }))
      .rejects.toBeInstanceOf(DomainError);
  });
});
