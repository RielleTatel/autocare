import { PrismaService } from "./prisma.service";

/**
 * The service connected on module init but never disconnected on destroy, so
 * `app.close()` in an e2e spec's afterAll tore down the Nest module while the
 * Prisma connection pool stayed open. Across 28 app-booting e2e specs those
 * pools accumulated until Supabase refused new connections
 * ("remaining connection slots are reserved"), and the same open handles kept
 * the event loop alive so jest never exited.
 */
describe("PrismaService lifecycle", () => {
  it("disconnects when the module is destroyed", async () => {
    const service = new PrismaService();
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("implements Nest's destroy hook, so app.close() actually releases the pool", () => {
    expect(typeof PrismaService.prototype.onModuleDestroy).toBe("function");
  });
});
