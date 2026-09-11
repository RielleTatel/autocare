import { UsersService } from "./users.service";
import { DomainError } from "../../common/errors/domain-error";

/**
 * Guards around role assignment, exercised against a stub client.
 *
 * These are deliberately not e2e: the admin-count guard reads across the whole
 * user table, so provoking it on the shared dev database would mean suspending
 * real admin accounts. Here the state is constructed exactly.
 */
type Stub = {
  user: { findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
  staffShift: { deleteMany: jest.Mock };
  $transaction: (cb: (tx: unknown) => unknown) => unknown;
};

function makeService(opts: { currentRole: string; otherActiveAdmins: number }) {
  const audit = { record: jest.fn() };
  const tx = {
    user: {
      count: jest.fn().mockResolvedValue(opts.otherActiveAdmins),
      update: jest.fn().mockResolvedValue({ id: "target", role: "MEMBER" }),
    },
    staffShift: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: opts.currentRole }) },
    $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
  } as unknown as Stub;

  const queue = { add: jest.fn() };
  return {
    service: new UsersService(prisma as never, audit as never, queue as never),
    tx,
    audit,
  };
}

const dto = { role: "MEMBER" as const, reason: "left the workshop" };

describe("UsersService.setRole", () => {
  it("refuses to demote the last remaining active admin", async () => {
    const { service, tx } = makeService({ currentRole: "ADMIN", otherActiveAdmins: 0 });

    await expect(service.setRole("actor", "target", dto)).rejects.toMatchObject({
      code: "FORBIDDEN_ROLE",
      httpStatus: 409,
    });
    // The whole point: nothing was written.
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("allows demoting an admin while another active admin remains", async () => {
    const { service, tx } = makeService({ currentRole: "ADMIN", otherActiveAdmins: 1 });

    await service.setRole("actor", "target", dto);

    expect(tx.user.update).toHaveBeenCalled();
  });

  it("counts admins other than the target, so a suspended peer does not count", async () => {
    const { service, tx } = makeService({ currentRole: "ADMIN", otherActiveAdmins: 1 });

    await service.setRole("actor", "target", dto);

    expect(tx.user.count).toHaveBeenCalledWith({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: "target" } },
    });
  });

  it("refuses to let anyone change their own role", async () => {
    const { service } = makeService({ currentRole: "ADMIN", otherActiveAdmins: 5 });

    await expect(service.setRole("same", "same", dto)).rejects.toBeInstanceOf(DomainError);
  });

  it("clears future shifts when leaving a staff role", async () => {
    const { service, tx } = makeService({ currentRole: "MECHANIC", otherActiveAdmins: 3 });

    const res = await service.setRole("actor", "target", dto);

    expect(tx.staffShift.deleteMany).toHaveBeenCalled();
    expect(res.clearedShifts).toBe(2);
  });

  it("keeps shifts when moving between two staff roles", async () => {
    const { service, tx } = makeService({ currentRole: "MECHANIC", otherActiveAdmins: 3 });

    const res = await service.setRole("actor", "target", { role: "ADVISOR", reason: "promoted to advisor" });

    // An advisor still works the roster; wiping their shifts would be wrong.
    expect(tx.staffShift.deleteMany).not.toHaveBeenCalled();
    expect(res.clearedShifts).toBe(0);
  });

  it("does not run the admin guard when the target was never an admin", async () => {
    const { service, tx } = makeService({ currentRole: "MEMBER", otherActiveAdmins: 0 });

    await service.setRole("actor", "target", { role: "MECHANIC", reason: "hired as technician" });

    expect(tx.user.count).not.toHaveBeenCalled();
  });

  it("records the reason in the audit trail", async () => {
    const { service, audit } = makeService({ currentRole: "MECHANIC", otherActiveAdmins: 3 });

    await service.setRole("actor", "target", dto);

    expect(audit.record).toHaveBeenCalledWith(
      "actor",
      expect.stringContaining("left the workshop"),
      "User",
      "target",
      expect.anything(),
      expect.anything(),
    );
  });
});
