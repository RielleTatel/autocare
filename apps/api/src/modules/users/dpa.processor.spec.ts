import { DpaProcessor } from "./dpa.processor";

describe("DpaProcessor", () => {
  const user = { id: "u1", name: "Juan", mobile: "+639170000001", email: null, vehicles: [{ plateNo: "ABA1234" }], consents: [] };
  const prisma: any = {
    dataRequest: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "dr1", userId: "u1", type: "EXPORT" }), update: jest.fn() },
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(user), update: jest.fn() },
  };
  const storage: any = { putObject: jest.fn().mockResolvedValue({ publicUrl: "file:///x/export.json" }), createDownloadUrl: jest.fn().mockResolvedValue("file:///x/export.json") };

  it("export job dumps the user's rows as parseable JSON and stores the result URL", async () => {
    const p = new DpaProcessor(prisma, storage);
    await p.process({ name: "dpa.export", data: { dataRequestId: "dr1" } } as any);
    const [, buf] = storage.putObject.mock.calls[0];
    const parsed = JSON.parse(buf.toString("utf8"));
    expect(parsed.user.mobile).toBe("+639170000001");
    expect(parsed.user.vehicles[0].plateNo).toBe("ABA1234");
    expect(prisma.dataRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "dr1" },
      data: expect.objectContaining({ status: "DONE", resultUrl: "file:///x/export.json" }),
    }));
  });

  it("erasure job marks the user for the 30-day anonymize pass", async () => {
    prisma.dataRequest.findUniqueOrThrow.mockResolvedValue({ id: "dr2", userId: "u1", type: "ERASURE" });
    const p = new DpaProcessor(prisma, storage);
    await p.process({ name: "dpa.erasure", data: { dataRequestId: "dr2" } } as any);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "u1" },
      data: expect.objectContaining({ erasureRequestedAt: expect.any(Date) }),
    }));
  });
});
